import React from 'react';
import {
  IAsrState,
  asrStatesEqual,
  normalizeAsrState,
} from '../business/asr/asrState';
import { AsrTarget } from '../business/asr/AsrTarget';
import { ILanguage } from '../control';
import { OrgWorkflowStepD, Project } from '../model';
import { TokenContext } from '../context/TokenProvider';
import { useGlobal } from '../context/useGlobal';
import { useOrbitData } from '../hoc/useOrbitData';
import { JSONParse, isLangSet } from '../utils';
import { logError, Severity } from '../utils/logErrorService';
import { useArtifactType } from './useArtifactType';
import { findRecord } from './tryFindRecord';
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
import { useOrgDefaults } from './useOrgDefaults';

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

/** Prefer the active Transcribe-step settings when they carry language for this artifact. */
export function resolveBoldClauseTranscriptionStepSettings(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  upstreamTool: string,
  recordingArtifactSlug: string,
  getOrgDefault: (label: string, orgId?: string) => unknown,
  orgId: string | undefined,
  currentStepSettings?: unknown
): TranscribeStepSettings {
  const upstream = getUpstreamRecordingStepSettings(
    orgSteps,
    slugFromId,
    upstreamTool,
    recordingArtifactSlug
  );
  const current = parseStepSettings(
    currentStepSettings as string | object | undefined
  );
  if (
    current?.artifactTypeId &&
    artifactTypeSlugFromSettings(current, slugFromId) ===
      recordingArtifactSlug &&
    hasTranscribeStepLanguageSettings(
      ToolSlug.Transcribe,
      current,
      slugFromId,
      getOrgDefault,
      orgId
    )
  ) {
    return current;
  }
  return upstream;
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

export interface BoldClauseStepLanguageOptions {
  orgSteps: OrgWorkflowStepD[];
  slugFromId: (id: string) => string;
  upstreamTool: string;
  recordingArtifactSlug: string;
  getOrgDefault: (label: string, orgId?: string) => unknown;
  orgId: string | undefined;
  currentStepSettings?: unknown;
}

/**
 * The recording step's primary language when it, not the org/project
 * vernacular, drives ASR ('und' when that step names none). Undefined when the
 * vernacular applies.
 */
export function boldClauseTranscriptionStepLanguage({
  orgSteps,
  slugFromId,
  upstreamTool,
  recordingArtifactSlug,
  getOrgDefault,
  orgId,
  currentStepSettings,
}: BoldClauseStepLanguageOptions): string | undefined {
  const settings = resolveBoldClauseTranscriptionStepSettings(
    orgSteps,
    slugFromId,
    upstreamTool,
    recordingArtifactSlug,
    getOrgDefault,
    orgId,
    currentStepSettings
  );
  const source = boldClauseAsrSource(
    settings,
    recordingArtifactSlug,
    slugFromId
  );
  return source.kind === 'step' ? source.primaryBcp47 : undefined;
}

export async function buildBoldClauseTranscriptionAsrState(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  upstreamTool: string,
  recordingArtifactSlug: string,
  getOrgDefault: (label: string, orgId?: string) => unknown,
  orgId: string | undefined,
  asrDefault: IAsrState,
  projectLang?: ILanguage,
  currentStepSettings?: unknown,
  token?: string | null
): Promise<IAsrState> {
  const settings = resolveBoldClauseTranscriptionStepSettings(
    orgSteps,
    slugFromId,
    upstreamTool,
    recordingArtifactSlug,
    getOrgDefault,
    orgId,
    currentStepSettings
  );
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
  return buildWorkflowAsrStateFromSettings(
    settings,
    slugFromId,
    getOrgDefault,
    orgId,
    asrDefault,
    projectLang,
    token
  );
}

export async function boldClauseTranscriptionNeedsSisterLanguage(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  upstreamTool: string,
  recordingArtifactSlug: string,
  getOrgDefault: (label: string, orgId?: string) => unknown,
  orgId: string | undefined,
  currentStepSettings?: unknown,
  token?: string | null
): Promise<boolean> {
  const settings = resolveBoldClauseTranscriptionStepSettings(
    orgSteps,
    slugFromId,
    upstreamTool,
    recordingArtifactSlug,
    getOrgDefault,
    orgId,
    currentStepSettings
  );
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

export function useBoldClauseTranscriptionAsrSettings(
  upstreamTool: string,
  recordingArtifactSlug: string,
  currentStepSettings?: unknown
) {
  const orgSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const [memory] = useGlobal('memory');
  const [organization] = useGlobal('organization');
  const [project] = useGlobal('project');
  const { getOrgDefault } = useOrgDefaults();
  const { slugFromId } = useArtifactType();
  const [errorReporter] = useGlobal('errorReporter');
  const [asrLoadFailed, setAsrLoadFailed] = React.useState(false);

  const asrDefault: IAsrState = React.useMemo(
    () => ({
      target: AsrTarget.alphabet,
      language: {
        bcp47: 'und',
        languageName: 'English',
        font: 'charissil',
        rtl: false,
        spellCheck: false,
      },
      asrIso: 'eng',
      dialect: undefined,
      selectRoman: false,
    }),
    []
  );

  const orgId = organization as string | undefined;
  const token = React.useContext(TokenContext)?.state?.accessToken ?? null;
  const [asrSettings, setAsrSettings] = React.useState<IAsrState>(() => ({
    ...asrDefault,
    asrIso: 'und',
    language: { ...asrDefault.language, bcp47: 'und', languageName: '' },
  }));
  const [needsSister, setNeedsSister] = React.useState(false);

  const projectLang = React.useMemo<ILanguage | undefined>(() => {
    if (!project) return undefined;
    const p = findRecord(memory, 'project', project) as Project | undefined;
    const bcp47 = p?.attributes?.language;
    if (!isLangSet(bcp47)) return undefined;
    return {
      bcp47,
      languageName: p?.attributes?.languageName ?? '',
      font: p?.attributes?.defaultFont ?? '',
      rtl: p?.attributes?.rtl ?? false,
      spellCheck: p?.attributes?.spellCheck ?? false,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  React.useEffect(() => {
    let cancelled = false;
    Promise.all([
      buildBoldClauseTranscriptionAsrState(
        orgSteps,
        slugFromId,
        upstreamTool,
        recordingArtifactSlug,
        getOrgDefault,
        orgId,
        asrDefault,
        projectLang,
        currentStepSettings,
        token
      ),
      boldClauseTranscriptionNeedsSisterLanguage(
        orgSteps,
        slugFromId,
        upstreamTool,
        recordingArtifactSlug,
        getOrgDefault,
        orgId,
        currentStepSettings,
        token
      ),
    ])
      .then(([next, needed]) => {
        if (cancelled) return;
        setAsrLoadFailed(false);
        setAsrSettings((prev) => (asrStatesEqual(prev, next) ? prev : next));
        setNeedsSister((prev) => (prev === needed ? prev : needed));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logError(
          Severity.error,
          errorReporter,
          err instanceof Error ? err : new Error(String(err))
        );
        setAsrLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
    // slugFromId (from useArtifactType) is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    orgSteps,
    upstreamTool,
    recordingArtifactSlug,
    orgId,
    getOrgDefault,
    asrDefault,
    projectLang,
    currentStepSettings,
    token,
    errorReporter,
  ]);

  const needsSisterLanguage = React.useCallback(
    () => needsSister,
    [needsSister]
  );

  const asrIsoReady = isLangSet(normalizeAsrState(asrSettings)?.asrIso);

  const stepLanguageBcp47 = React.useMemo(
    () =>
      boldClauseTranscriptionStepLanguage({
        orgSteps,
        slugFromId,
        upstreamTool,
        recordingArtifactSlug,
        getOrgDefault,
        orgId,
        currentStepSettings,
      }),
    // slugFromId (from useArtifactType) is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      orgSteps,
      upstreamTool,
      recordingArtifactSlug,
      orgId,
      getOrgDefault,
      currentStepSettings,
    ]
  );

  return {
    asrSettings,
    needsSisterLanguage,
    asrIsoReady,
    asrLoadFailed,
    stepLanguageBcp47,
  };
}
