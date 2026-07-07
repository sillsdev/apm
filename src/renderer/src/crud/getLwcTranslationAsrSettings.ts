import React from 'react';
import { IAsrState, normalizeAsrState } from '../business/asr/asrState';
import { AsrTarget } from '../business/asr/AsrTarget';
import { ILanguage } from '../control';
import { OrgWorkflowStepD, Project } from '../model';
import { useGlobal } from '../context/useGlobal';
import { useOrbitData } from '../hoc/useOrbitData';
import { JSONParse, isLangSet } from '../utils';
import { getPreferredAsrMethod } from '../business/asr/asrLanguages';
import { useArtifactType } from './useArtifactType';
import { findRecord } from './tryFindRecord';
import { ArtifactTypeSlug } from './artifactTypeSlug';
import { ToolSlug } from './toolSlug';
import {
  artifactTypeSlugFromSettings,
  buildVernacularAsrState,
  buildWorkflowAsrStateFromSettings,
  hasTranscribeStepLanguageSettings,
  transcribeSettingsNeedSisterLanguage,
  type TranscribeStepSettings,
} from './transcribeStepAsrSettings';
import { orgDefaultLangProps, useOrgDefaults } from './useOrgDefaults';

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

export function buildUpstreamRecordingAsrState(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  upstreamTool: string,
  recordingArtifactSlug: string,
  getOrgDefault: (label: string, orgId?: string) => unknown,
  orgId: string | undefined,
  asrDefault: IAsrState,
  projectLang?: ILanguage
): IAsrState {
  const settings = getUpstreamRecordingStepSettings(
    orgSteps,
    slugFromId,
    upstreamTool,
    recordingArtifactSlug
  );
  if (
    recordingArtifactSlug === ArtifactTypeSlug.CarefulSpeech &&
    !hasTranscribeStepLanguageSettings(
      upstreamTool,
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    )
  ) {
    return buildVernacularAsrState(
      settings,
      getOrgDefault,
      orgId,
      asrDefault,
      projectLang
    );
  }
  return buildWorkflowAsrStateFromSettings(
    settings,
    slugFromId,
    getOrgDefault,
    orgId,
    asrDefault,
    projectLang
  );
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

export function buildBoldClauseTranscriptionAsrState(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  upstreamTool: string,
  recordingArtifactSlug: string,
  getOrgDefault: (label: string, orgId?: string) => unknown,
  orgId: string | undefined,
  asrDefault: IAsrState,
  projectLang?: ILanguage,
  currentStepSettings?: unknown
): IAsrState {
  const settings = resolveBoldClauseTranscriptionStepSettings(
    orgSteps,
    slugFromId,
    upstreamTool,
    recordingArtifactSlug,
    getOrgDefault,
    orgId,
    currentStepSettings
  );
  const hasStepLanguage =
    hasTranscribeStepLanguageSettings(
      ToolSlug.Transcribe,
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    ) ||
    hasTranscribeStepLanguageSettings(
      upstreamTool,
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    );
  if (
    recordingArtifactSlug === ArtifactTypeSlug.CarefulSpeech &&
    !hasStepLanguage
  ) {
    return buildVernacularAsrState(
      settings,
      getOrgDefault,
      orgId,
      asrDefault,
      projectLang
    );
  }
  return buildWorkflowAsrStateFromSettings(
    settings,
    slugFromId,
    getOrgDefault,
    orgId,
    asrDefault,
    projectLang
  );
}

export function boldClauseTranscriptionHasAsrLanguage(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  upstreamTool: string,
  recordingArtifactSlug: string,
  getOrgDefault: (label: string, orgId?: string) => unknown,
  orgId: string | undefined,
  currentStepSettings?: unknown
): boolean {
  const settings = resolveBoldClauseTranscriptionStepSettings(
    orgSteps,
    slugFromId,
    upstreamTool,
    recordingArtifactSlug,
    getOrgDefault,
    orgId,
    currentStepSettings
  );
  if (
    hasTranscribeStepLanguageSettings(
      ToolSlug.Transcribe,
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    ) ||
    hasTranscribeStepLanguageSettings(
      upstreamTool,
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    )
  ) {
    return true;
  }
  if (recordingArtifactSlug === ArtifactTypeSlug.CarefulSpeech) {
    const orgLang = getOrgDefault(orgDefaultLangProps, orgId) as
      | ILanguage
      | undefined;
    return isLangSet(orgLang?.bcp47);
  }
  return false;
}

export function boldClauseTranscriptionNeedsSisterLanguage(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  upstreamTool: string,
  recordingArtifactSlug: string,
  getOrgDefault: (label: string, orgId?: string) => unknown,
  orgId: string | undefined,
  currentStepSettings?: unknown
): boolean {
  const settings = resolveBoldClauseTranscriptionStepSettings(
    orgSteps,
    slugFromId,
    upstreamTool,
    recordingArtifactSlug,
    getOrgDefault,
    orgId,
    currentStepSettings
  );
  if (
    recordingArtifactSlug === ArtifactTypeSlug.CarefulSpeech &&
    !hasTranscribeStepLanguageSettings(
      ToolSlug.Transcribe,
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    ) &&
    !hasTranscribeStepLanguageSettings(
      upstreamTool,
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    )
  ) {
    return transcribeSettingsNeedSisterLanguage(
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    );
  }
  return transcribeSettingsNeedSisterLanguage(
    settings,
    slugFromId,
    getOrgDefault,
    orgId
  );
}

export function upstreamRecordingHasAsrLanguage(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  upstreamTool: string,
  recordingArtifactSlug: string,
  getOrgDefault: (label: string, orgId?: string) => unknown,
  orgId: string | undefined
): boolean {
  const settings = getUpstreamRecordingStepSettings(
    orgSteps,
    slugFromId,
    upstreamTool,
    recordingArtifactSlug
  );
  if (
    hasTranscribeStepLanguageSettings(
      upstreamTool,
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    )
  ) {
    return true;
  }
  if (recordingArtifactSlug === ArtifactTypeSlug.CarefulSpeech) {
    const orgLang = getOrgDefault(orgDefaultLangProps, orgId) as
      | ILanguage
      | undefined;
    return isLangSet(orgLang?.bcp47);
  }
  return false;
}

export function upstreamRecordingNeedsSisterLanguage(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  upstreamTool: string,
  recordingArtifactSlug: string,
  getOrgDefault: (label: string, orgId?: string) => unknown,
  orgId: string | undefined
): boolean {
  const settings = getUpstreamRecordingStepSettings(
    orgSteps,
    slugFromId,
    upstreamTool,
    recordingArtifactSlug
  );
  if (
    recordingArtifactSlug === ArtifactTypeSlug.CarefulSpeech &&
    !hasTranscribeStepLanguageSettings(
      upstreamTool,
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    )
  ) {
    return transcribeSettingsNeedSisterLanguage(
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    );
  }
  return transcribeSettingsNeedSisterLanguage(
    settings,
    slugFromId,
    getOrgDefault,
    orgId
  );
}

export function findLwcTranslationWorkflowStep(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string
): OrgWorkflowStepD | undefined {
  return findUpstreamRecordingWorkflowStep(
    orgSteps,
    slugFromId,
    ToolSlug.PhraseBackTranslate,
    ArtifactTypeSlug.PhraseBackTranslation
  );
}

export function getLwcTranslationStepSettings(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string
): TranscribeStepSettings {
  const step = findLwcTranslationWorkflowStep(orgSteps, slugFromId);
  if (!step) return {};
  const json = JSONParse(step.attributes?.tool ?? '{}') as {
    settings?: string | object;
  };
  return parseStepSettings(json.settings);
}

export function buildLwcTranslationAsrState(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  getOrgDefault: (label: string, orgId?: string) => unknown,
  orgId: string | undefined,
  asrDefault: IAsrState,
  projectLang?: ILanguage
): IAsrState {
  return buildUpstreamRecordingAsrState(
    orgSteps,
    slugFromId,
    ToolSlug.PhraseBackTranslate,
    ArtifactTypeSlug.PhraseBackTranslation,
    getOrgDefault,
    orgId,
    asrDefault,
    projectLang
  );
}

export function lwcTranslationHasAsrLanguage(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  getOrgDefault: (label: string, orgId?: string) => unknown,
  orgId: string | undefined
): boolean {
  return upstreamRecordingHasAsrLanguage(
    orgSteps,
    slugFromId,
    ToolSlug.PhraseBackTranslate,
    ArtifactTypeSlug.PhraseBackTranslation,
    getOrgDefault,
    orgId
  );
}

export function lwcTranslationNeedsSisterLanguage(
  orgSteps: OrgWorkflowStepD[],
  slugFromId: (id: string) => string,
  getOrgDefault: (label: string, orgId?: string) => unknown,
  orgId: string | undefined
): boolean {
  return upstreamRecordingNeedsSisterLanguage(
    orgSteps,
    slugFromId,
    ToolSlug.PhraseBackTranslate,
    ArtifactTypeSlug.PhraseBackTranslation,
    getOrgDefault,
    orgId
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
      method: getPreferredAsrMethod('eng'),
      dialect: undefined,
      selectRoman: false,
    }),
    []
  );

  const orgId = organization as string | undefined;

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

  const getAsrSettings = React.useCallback(
    () =>
      buildBoldClauseTranscriptionAsrState(
        orgSteps,
        slugFromId,
        upstreamTool,
        recordingArtifactSlug,
        getOrgDefault,
        orgId,
        asrDefault,
        projectLang,
        currentStepSettings
      ),
    [
      orgSteps,
      slugFromId,
      upstreamTool,
      recordingArtifactSlug,
      getOrgDefault,
      orgId,
      asrDefault,
      projectLang,
      currentStepSettings,
    ]
  );

  const hasRecordingLanguage = React.useCallback(
    () =>
      boldClauseTranscriptionHasAsrLanguage(
        orgSteps,
        slugFromId,
        upstreamTool,
        recordingArtifactSlug,
        getOrgDefault,
        orgId,
        currentStepSettings
      ),
    [
      orgSteps,
      slugFromId,
      upstreamTool,
      recordingArtifactSlug,
      getOrgDefault,
      orgId,
      currentStepSettings,
    ]
  );

  const needsSisterLanguage = React.useCallback(
    () =>
      boldClauseTranscriptionNeedsSisterLanguage(
        orgSteps,
        slugFromId,
        upstreamTool,
        recordingArtifactSlug,
        getOrgDefault,
        orgId,
        currentStepSettings
      ),
    [
      orgSteps,
      slugFromId,
      upstreamTool,
      recordingArtifactSlug,
      getOrgDefault,
      orgId,
      currentStepSettings,
    ]
  );

  const asrSettings = React.useMemo(() => getAsrSettings(), [getAsrSettings]);

  const asrIsoReady = isLangSet(normalizeAsrState(asrSettings)?.asrIso);

  return {
    getAsrSettings,
    asrSettings,
    hasRecordingLanguage,
    needsSisterLanguage,
    asrIsoReady,
  };
}

export function useLwcTranscriptionAsrSettings() {
  const result = useBoldClauseTranscriptionAsrSettings(
    ToolSlug.PhraseBackTranslate,
    ArtifactTypeSlug.PhraseBackTranslation
  );
  return {
    ...result,
    hasLwcLanguage: result.hasRecordingLanguage,
  };
}
