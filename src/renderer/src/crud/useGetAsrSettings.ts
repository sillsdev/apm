import React from 'react';
import { IAsrState, normalizeAsrState } from '../business/asr/asrState';
import { IAsrLanguageSuggestion } from '../business/asr/useRecommendAsrLanguage';
import { OrganizationD, OrgWorkflowStepD, Project } from '../model';
import { ILanguage } from '../control';
import {
  orgDefaultAsr,
  orgDefaultLangProps,
  useOrgDefaults,
} from './useOrgDefaults';
import {
  projDefSisterRecommendations,
  useProjectDefaults,
} from './useProjectDefaults';
import { useGlobal } from '../context/useGlobal';
import { PassageDetailContext } from '../context/PassageDetailContext';
import { useOrbitData } from '../hoc/useOrbitData';
import { JSONParse, isLangSet } from '../utils';
import { getPreferredAsrMethod } from '../business/asr/asrLanguages';
import { UpdateRecord } from '../model/baseModel';
import { AsrTarget } from '../business/asr/AsrTarget';
import { useArtifactType } from './useArtifactType';
import { findRecord } from './tryFindRecord';

import {
  artifactTypeSlugFromSettings,
  artifactUsesOrgVernacularLanguage,
  buildVernacularAsrState,
  buildWorkflowAsrStateFromSettings,
  hasTranscribeStepLanguageSettings,
  transcribeSettingsNeedSisterLanguage,
  type TranscribeStepSettings,
} from './transcribeStepAsrSettings';

export {
  artifactTypeSlugFromSettings,
  artifactUsesOrgVernacularLanguage,
  hasTranscribeStepLanguageSettings,
  transcribeSettingsNeedSisterLanguage,
  buildVernacularAsrState,
  buildWorkflowAsrStateFromSettings,
  parseStepLanguageField,
  formatStepLanguageField,
} from './transcribeStepAsrSettings';
export type {
  SlugFromIdFn,
  TranscribeStepSettings,
  IStepLanguageInfo,
} from './transcribeStepAsrSettings';

export function useGetAsrSettings(team?: OrganizationD) {
  const orgSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const [organization] = useGlobal('organization');
  const [project] = useGlobal('project');
  const { getOrgDefault, setOrgDefault, canSetOrgDefault } = useOrgDefaults();
  const { getProjectDefault, setProjectDefault } = useProjectDefaults();
  const { slugFromId } = useArtifactType();
  const ctx = React.useContext(PassageDetailContext);
  const currentstep = ctx?.state?.currentstep;

  const asrDefault: IAsrState = {
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
  };

  const orgId = team?.id ?? organization;

  // The current project's vernacular language. When it differs from the org
  // default language the transcribe step was configured for, ASR resolution
  // uses the project language instead of the saved step settings.
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
  }, [project, memory]);

  // The language actually being transcribed: the project's vernacular when set,
  // otherwise the org default vernacular. Used to decide whether a sister ASR
  // language is needed in the run-time picker.
  const getVernacularLanguage = (): ILanguage | undefined =>
    projectLang ??
    (getOrgDefault(orgDefaultLangProps, orgId) as ILanguage | undefined);

  const projectDiffersFromOrg = () => {
    if (!projectLang) return false;
    const orgLang = getOrgDefault(orgDefaultLangProps, orgId) as
      | ILanguage
      | undefined;
    return projectLang.bcp47 !== (orgLang?.bcp47 ?? 'und');
  };

  const parseCachedRecommendations = (
    cached:
      | { forLanguage?: string; suggestions?: IAsrLanguageSuggestion[] }
      | undefined,
    forLanguage: string
  ): IAsrLanguageSuggestion[] | undefined => {
    if (
      cached?.forLanguage !== forLanguage ||
      !Array.isArray(cached?.suggestions)
    )
      return undefined;
    return cached.suggestions.map((s) => ({ ...s, raw: s }));
  };

  /**
   * Sister-language recommendations cached so they're queried only once.
   * - Project matches the org: reuse the cache the step editor stored on the org
   *   step (keyed by the org vernacular language name).
   * - Project differs: reuse the per-project cache (keyed by the project bcp47 so
   *   it's invalidated when the project language changes).
   * Returns undefined when no usable cache exists.
   */
  const getCachedSisterRecommendations = ():
    | IAsrLanguageSuggestion[]
    | undefined => {
    if (projectDiffersFromOrg()) {
      const cached = getProjectDefault(projDefSisterRecommendations) as
        | { forLanguage?: string; suggestions?: IAsrLanguageSuggestion[] }
        | undefined;
      return parseCachedRecommendations(cached, projectLang?.bcp47 ?? 'und');
    }
    const langName = getVernacularLanguage()?.languageName ?? '';
    const step = orgSteps.find((s) => s.id === currentstep);
    const json = JSONParse(step?.attributes?.tool ?? '{}') as Record<
      string,
      string
    >;
    const settings = parseStepSettings(json?.settings) as Record<
      string,
      unknown
    >;
    const raw = settings?.sisterRecommendations;
    if (typeof raw !== 'string') return undefined;
    try {
      return parseCachedRecommendations(JSON.parse(raw), langName);
    } catch {
      return undefined;
    }
  };

  /**
   * Persist sister-language recommendations to the project default (only when the
   * project language differs from the org), so they're queried just once. Stored
   * with the project bcp47 so a project language change invalidates them.
   */
  const saveSisterRecommendations = (suggestions: IAsrLanguageSuggestion[]) => {
    if (!projectDiffersFromOrg()) return;
    const lean = suggestions.map((s) => ({
      languageName: s.languageName,
      iso: s.iso,
      methods: s.methods,
      reason: s.reason,
    }));
    setProjectDefault(projDefSisterRecommendations, {
      forLanguage: projectLang?.bcp47 ?? 'und',
      suggestions: lean,
    });
  };

  const parseStepSettings = (settingsJson: string | undefined) =>
    JSONParse(settingsJson ?? '{}') as TranscribeStepSettings;

  const getArtIdFromSettings = (settings: TranscribeStepSettings) => {
    return String(settings?.artifactTypeId ?? '');
  };
  const getVernacularAsrState = (settings: TranscribeStepSettings) =>
    buildVernacularAsrState(
      settings,
      getOrgDefault,
      orgId,
      asrDefault,
      projectLang
    );

  const getWorkflowAsrState = () => {
    const step = orgSteps.find((s) => s.id === currentstep);
    const json = JSONParse(step?.attributes?.tool ?? '{}') as Record<
      string,
      string
    >;
    const settings = parseStepSettings(json?.settings);
    return buildWorkflowAsrStateFromSettings(
      settings,
      slugFromId,
      getOrgDefault,
      orgId,
      asrDefault,
      projectLang
    );
  };

  const getAsrSettings = () => {
    const step = orgSteps.find((s) => s.id === currentstep);
    const json = JSONParse(step?.attributes?.tool ?? '{}') as Record<
      string,
      string
    >;
    const settings = parseStepSettings(json?.settings);
    const slug = artifactTypeSlugFromSettings(settings, slugFromId);

    // A per-project ASR config (saved on Run) takes precedence over the
    // org-level step settings, so the user's last choice always sticks.
    if (artifactUsesOrgVernacularLanguage(slug)) {
      const projAsr = normalizeAsrState(getProjectDefault(orgDefaultAsr));
      if (isLangSet(projAsr?.asrIso)) return projAsr;
    }

    const hasStepLang = hasTranscribeStepLanguageSettings(
      json.tool,
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    );
    const artId = getArtIdFromSettings(settings);
    if (!hasStepLang) {
      const orgAsr = normalizeAsrState(getOrgDefault(orgDefaultAsr, orgId));
      if (orgAsr) return orgAsr;
    }
    if (!artId) {
      return getVernacularAsrState(settings);
    }
    return getWorkflowAsrState();
  };

  /**
   * Whether the current user may save ASR settings as the team (org) default:
   * an admin (online) whose org default language is either unset or matches the
   * project language.
   */
  const canSetTeamAsrDefault = (): boolean => {
    if (!canSetOrgDefault) return false;
    const orgLang = getOrgDefault(orgDefaultLangProps, orgId) as
      | ILanguage
      | undefined;
    const orgBcp = orgLang?.bcp47 ?? 'und';
    return !isLangSet(orgBcp) || orgBcp === (projectLang?.bcp47 ?? 'und');
  };

  /**
   * Persist the chosen ASR settings as the org (team) default. Also sets the org
   * default language to the project's vernacular so the org default is fully
   * defined (e.g. when the org language was previously unset).
   */
  const saveTeamAsrSettings = (asrState: IAsrState) => {
    const vernacular = getVernacularLanguage();
    if (isLangSet(vernacular?.bcp47)) {
      setOrgDefault(orgDefaultLangProps, vernacular, orgId);
    }
    setOrgDefault(orgDefaultAsr, asrState, orgId);
    // Drop any per-project override so the new team default isn't shadowed.
    setProjectDefault(orgDefaultAsr, undefined);
  };

  /**
   * Persist the chosen ASR settings to the project default so any change the user
   * makes sticks (the team-default path saves to the org instead). Only applies to
   * artifacts driven by the org/project vernacular; step-language artifacts keep
   * their own per-step language settings.
   */
  const saveProjectAsrSettings = (asrState: IAsrState) => {
    const step = orgSteps.find((s) => s.id === currentstep);
    const json = JSONParse(step?.attributes?.tool ?? '{}') as Record<
      string,
      string
    >;
    const settings = parseStepSettings(json?.settings);
    const slug = artifactTypeSlugFromSettings(settings, slugFromId);
    if (!artifactUsesOrgVernacularLanguage(slug)) return;
    setProjectDefault(orgDefaultAsr, asrState);
  };

  const hasTranscribeStepLanguageSettingsHook = () => {
    const step = orgSteps.find((s) => s.id === currentstep);
    const json = JSONParse(step?.attributes?.tool ?? '{}') as Record<
      string,
      string
    >;
    const settings = parseStepSettings(json?.settings);
    return hasTranscribeStepLanguageSettings(
      json.tool,
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    );
  };

  const transcribeSettingsNeedSisterLanguageHook = () => {
    const step = orgSteps.find((s) => s.id === currentstep);
    const json = JSONParse(step?.attributes?.tool ?? '{}') as Record<
      string,
      string
    >;
    const settings = parseStepSettings(json?.settings);
    return transcribeSettingsNeedSisterLanguage(
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    );
  };
  const saveTranscribeStepSettings = (settings: string) => {
    const step = orgSteps.find((s) => s.id === currentstep);
    if (!step) return;
    const json = JSONParse(step?.attributes?.tool ?? '{}') as Record<
      string,
      string
    >;
    json.settings = settings;
    step.attributes.tool = JSON.stringify(json);
    memory.update((t) => UpdateRecord(t, step, user));
  };

  return {
    getAsrSettings,
    getVernacularLanguage,
    getCachedSisterRecommendations,
    saveSisterRecommendations,
    canSetTeamAsrDefault,
    saveTeamAsrSettings,
    saveProjectAsrSettings,
    saveTranscribeStepSettings,
    hasTranscribeStepLanguageSettings: hasTranscribeStepLanguageSettingsHook,
    transcribeSettingsNeedSisterLanguage:
      transcribeSettingsNeedSisterLanguageHook,
  };
}
