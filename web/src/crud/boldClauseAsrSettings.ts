import { IAsrState } from '../business/asr/asrState';
import { ILanguage } from '../control';
import { OrgWorkflowStepD } from '../model';
import { JSONParse, isLangSet } from '../utils';
import { ArtifactTypeSlug } from './artifactTypeSlug';
import { ToolSlug } from './toolSlug';
import {
  artifactTypeSlugFromSettings,
  buildVernacularAsrState,
  buildWorkflowAsrStateFromSettings,
  artifactUsesOrgVernacularLanguage,
  asrTargetFromSettings,
  hasTranscribeStepLanguageSettings,
  parseStepLanguageField,
  transcribeSettingsNeedSisterLanguage,
  type TranscribeStepSettings,
} from './transcribeStepAsrSettings';

function parseStepSettings(settingsJson: string | object | undefined) {
  if (!settingsJson) return {} as TranscribeStepSettings;
  if (typeof settingsJson === 'object') {
    return settingsJson as TranscribeStepSettings;
  }
  try {
    return JSON.parse(settingsJson) as TranscribeStepSettings;
  } catch {
    return {} as TranscribeStepSettings;
  }
}

export function findUpstreamRecordingWorkflowStep(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  upstreamTool: string,
  recordingArtifactSlug: string
): OrgWorkflowStepD | undefined {
  return orgSteps.find((s) => {
    const json = JSONParse(s?.attributes?.tool ?? '{}') as {
      tool?: string;
      settings?: string | object;
    };
    if (json.tool !== upstreamTool) return false;
    const settings = parseStepSettings(json.settings);
    if (!settings?.artifactTypeId) return false;
    const slug = artifactTypeSlugFromSettings(settings, slugFromId);
    return slug === recordingArtifactSlug;
  });
}

export function getUpstreamRecordingStepSettings(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  upstreamTool: string,
  recordingArtifactSlug: string
): TranscribeStepSettings {
  const step = findUpstreamRecordingWorkflowStep(
    orgSteps,
    slugFromId,
    upstreamTool,
    recordingArtifactSlug
  );
  if (!step) return {};
  const json = JSONParse(step.attributes?.tool ?? '{}') as {
    settings?: string | object;
  };
  return parseStepSettings(json.settings);
}

/**
 * Which step bold-clause ASR reads (and so saves to): the active Transcribe
 * step when it names this recording's artifact and a language, else the
 * upstream recording step.
 */
export function boldClauseAsrSettingsSource(
  slugFromId: (id: string) => string,
  recordingArtifactSlug: string,
  getOrgDefault: (label: string, orgId?: string) => unknown,
  orgId: string | undefined,
  currentStepSettings?: unknown
): 'current' | 'upstream' {
  const current = parseStepSettings(
    currentStepSettings as string | object | undefined
  );
  const currentNamesLanguage =
    Boolean(current?.artifactTypeId) &&
    artifactTypeSlugFromSettings(current, slugFromId) ===
      recordingArtifactSlug &&
    hasTranscribeStepLanguageSettings(
      ToolSlug.Transcribe,
      current,
      slugFromId,
      getOrgDefault,
      orgId
    );
  return currentNamesLanguage ? 'current' : 'upstream';
}

export interface BoldClauseStepLanguageOptions {
  orgSteps: OrgWorkflowStepD[];
  slugFromId: (id: string) => string;
  upstreamTool: string;
  recordingArtifactSlug: string;
  getOrgDefault: (label: string, orgId?: string) => unknown;
  orgId: string | undefined;
  currentStepSettings?: unknown;
}

/** What the bold-clause ASR builder needs on top of the step lookup. */
export interface BoldClauseAsrStateOptions extends BoldClauseStepLanguageOptions {
  asrDefault: IAsrState;
  projectLang?: ILanguage;
  token?: string | null;
}

/** Prefer the active Transcribe-step settings when they carry language for this artifact. */
export function resolveBoldClauseTranscriptionStepSettings({
  orgSteps,
  slugFromId,
  upstreamTool,
  recordingArtifactSlug,
  getOrgDefault,
  orgId,
  currentStepSettings,
}: BoldClauseStepLanguageOptions): TranscribeStepSettings {
  const upstream = getUpstreamRecordingStepSettings(
    orgSteps,
    slugFromId,
    upstreamTool,
    recordingArtifactSlug
  );
  const source = boldClauseAsrSettingsSource(
    slugFromId,
    recordingArtifactSlug,
    getOrgDefault,
    orgId,
    currentStepSettings
  );
  return source === 'current'
    ? parseStepSettings(currentStepSettings as string | object | undefined)
    : upstream;
}

/**
 * Where bold-clause ASR takes its language from. Careful Speech is vernacular
 * audio unless its recording step names another language. Other recordings
 * (e.g. LWC translation) are never in the vernacular: without a step language
 * the user picks one, rather than falling back to English or the vernacular.
 */
export type BoldClauseAsrSource =
  { kind: 'vernacular' } | { kind: 'step'; primaryBcp47: string };

export function boldClauseAsrSource(
  settings: TranscribeStepSettings,
  recordingArtifactSlug: string,
  slugFromId: (id: string) => string
): BoldClauseAsrSource {
  const slug = settings?.artifactTypeId
    ? artifactTypeSlugFromSettings(settings, slugFromId)
    : undefined;
  if (slug && artifactUsesOrgVernacularLanguage(slug)) {
    return { kind: 'vernacular' };
  }
  const primary = slug ? parseStepLanguageField(settings.language).bcp47 : '';
  if (isLangSet(primary)) return { kind: 'step', primaryBcp47: primary };
  if (recordingArtifactSlug === ArtifactTypeSlug.CarefulSpeech) {
    return { kind: 'vernacular' };
  }
  return { kind: 'step', primaryBcp47: 'und' };
}

/**
 * The recording step's primary language when it, not the org/project
 * vernacular, drives ASR ('und' when that step names none). Undefined when the
 * vernacular applies.
 */
export function boldClauseTranscriptionStepLanguage(
  options: BoldClauseStepLanguageOptions
): string | undefined {
  const settings = resolveBoldClauseTranscriptionStepSettings(options);
  const source = boldClauseAsrSource(
    settings,
    options.recordingArtifactSlug,
    options.slugFromId
  );
  return source.kind === 'step' ? source.primaryBcp47 : undefined;
}

export async function buildBoldClauseTranscriptionAsrState(
  options: BoldClauseAsrStateOptions
): Promise<IAsrState> {
  const {
    slugFromId,
    recordingArtifactSlug,
    getOrgDefault,
    orgId,
    asrDefault,
    projectLang,
    token,
  } = options;
  const settings = resolveBoldClauseTranscriptionStepSettings(options);
  const source = boldClauseAsrSource(
    settings,
    recordingArtifactSlug,
    slugFromId
  );
  if (source.kind === 'vernacular') {
    return buildVernacularAsrState(
      settings,
      getOrgDefault,
      orgId,
      asrDefault,
      projectLang,
      token
    );
  }
  if (!isLangSet(source.primaryBcp47)) {
    // No language known for this recording: leave it unset for the user to pick.
    return {
      ...asrDefault,
      target: settings?.artifactTypeId
        ? asrTargetFromSettings(settings)
        : asrDefault.target,
      asrIso: 'und',
      language: { ...asrDefault.language, bcp47: 'und', languageName: '' },
    };
  }
  return buildWorkflowAsrStateFromSettings({
    settings,
    slugFromId,
    getOrgDefault,
    orgId,
    asrDefault,
    projectLang,
    token,
  });
}

export async function boldClauseTranscriptionNeedsSisterLanguage(
  options: BoldClauseStepLanguageOptions & { token?: string | null }
): Promise<boolean> {
  const { slugFromId, recordingArtifactSlug, getOrgDefault, orgId, token } =
    options;
  const settings = resolveBoldClauseTranscriptionStepSettings(options);
  const source = boldClauseAsrSource(
    settings,
    recordingArtifactSlug,
    slugFromId
  );
  // With no language to check there is no sister to need; the user picks one.
  if (source.kind === 'step' && !isLangSet(source.primaryBcp47)) return false;
  return transcribeSettingsNeedSisterLanguage(
    settings,
    slugFromId,
    getOrgDefault,
    orgId,
    token
  );
}
