import React from 'react';
import {
  IAsrState,
  asrStatesEqual,
  defaultAsrState,
  normalizeAsrState,
} from '../business/asr/asrState';
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
import { TokenContext } from '../context/TokenProvider';
import { useGlobal } from '../context/useGlobal';
import { PassageDetailContext } from '../context/PassageDetailContext';
import { useOrbitData } from '../hoc/useOrbitData';
import { JSONParse, isLangSet } from '../utils';
import { UpdateRecord } from '../model/baseModel';
import { needsSisterLanguage } from '../business/asr/asrLanguages';
import { useArtifactType } from './useArtifactType';
import { findRecord } from './tryFindRecord';
import { useSetTeamLanguage } from './useSetTeamLanguage';

import {
  artifactTypeSlugFromSettings,
  artifactUsesOrgVernacularLanguage,
  buildVernacularAsrState,
  buildWorkflowAsrStateFromSettings,
  hasTranscribeStepLanguageSettings,
  readSisterRecommendations,
  stepSettingsFromAsrState,
  stepSisterRecommendationKey,
  transcribeSettingsNeedSisterLanguage,
  withSisterRecommendations,
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
  const setTeamLanguage = useSetTeamLanguage();
  const { slugFromId } = useArtifactType();
  const ctx = React.useContext(PassageDetailContext);
  const currentstep = ctx?.state?.currentstep;
  const token = React.useContext(TokenContext)?.state?.accessToken ?? null;

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
    // memory is a stable global; intentionally omitted (repo convention).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project]);

  // The language actually being transcribed: the project's vernacular when set,
  // otherwise the org default vernacular. Used to decide whether a sister ASR
  // language is needed in the run-time picker.
  const getVernacularLanguage = (): ILanguage | undefined =>
    projectLang ??
    (getOrgDefault(orgDefaultLangProps, orgId) as ILanguage | undefined);

  const projectDiffersFromOrg = () => {
    if (!projectLang) return false;
    const orgLang = getOrgDefault(orgDefaultLangProps, orgId) as
      ILanguage | undefined;
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
    IAsrLanguageSuggestion[] | undefined => {
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

  const stepTool = (stepId: string | undefined) => {
    const step = stepId
      ? (findRecord(memory, 'orgworkflowstep', stepId) as
          OrgWorkflowStepD | undefined)
      : undefined;
    const json = JSONParse(step?.attributes?.tool ?? '{}') as Record<
      string,
      string
    >;
    return { step, json, settings: parseStepSettings(json?.settings) };
  };

  /**
   * Sister recommendations cached on a step that uses its own language: the
   * step its ASR settings are read from, which may not be the current step.
   */
  const getCachedStepSisterRecommendations = (
    stepId: string | undefined
  ): IAsrLanguageSuggestion[] | undefined => {
    const { settings } = stepTool(stepId);
    const stored = readSisterRecommendations(
      settings,
      stepSisterRecommendationKey(settings)
    );
    if (!stored) return undefined;
    return stored.map((s) => ({ ...s, raw: s }));
  };

  const saveStepSisterRecommendations = (
    stepId: string | undefined,
    suggestions: IAsrLanguageSuggestion[]
  ) => {
    const { step, json, settings } = stepTool(stepId);
    if (!step) return;
    const key = stepSisterRecommendationKey(settings);
    if (!key) return;
    json.settings = JSON.stringify(
      withSisterRecommendations(settings, key, suggestions)
    );
    step.attributes.tool = JSON.stringify(json);
    void memory.update((t) => UpdateRecord(t, step, user));
  };

  const parseStepSettings = (settingsJson: string | undefined) =>
    JSONParse(settingsJson ?? '{}') as TranscribeStepSettings;

  /** The step transcribes the vernacular, and this project's differs from the team's. */
  const usesProjectAsr = (settings: TranscribeStepSettings) =>
    projectDiffersFromOrg() &&
    artifactUsesOrgVernacularLanguage(
      artifactTypeSlugFromSettings(settings, slugFromId)
    );

  /**
   * A saved project choice in another language is a sister, which applies
   * only while the project's language needs one. Earlier builds saved every
   * Run here, including the team's sister for a project the service can
   * transcribe directly; the dialog hides the picker then, so it couldn't be
   * changed.
   */
  const savedProjectAsrApplies = async (projAsr: IAsrState) => {
    const projBcp = projectLang?.bcp47 ?? 'und';
    if (projAsr.language?.bcp47 === projBcp) return true;
    return needsSisterLanguage(projBcp, token);
  };

  const getAsrSettings = React.useCallback(async () => {
    const step = orgSteps.find((s) => s.id === currentstep);
    const json = JSONParse(step?.attributes?.tool ?? '{}') as Record<
      string,
      string
    >;
    const settings = parseStepSettings(json?.settings);
    // A project whose language differs from the team's keeps its own ASR
    // choice (saved on Run), since the team default can't describe it.
    const projectOwnsAsr = usesProjectAsr(settings);
    if (projectOwnsAsr) {
      const projAsr = normalizeAsrState(getProjectDefault(orgDefaultAsr));
      if (
        projAsr &&
        isLangSet(projAsr.asrIso) &&
        (await savedProjectAsrApplies(projAsr))
      )
        return projAsr;
    }
    const hasStepLang = hasTranscribeStepLanguageSettings(
      json.tool,
      settings,
      slugFromId,
      getOrgDefault,
      orgId
    );
    const artifactTypeId = settings?.artifactTypeId ?? '';
    // No step language to go on (no current step, another tool, or a step
    // whose own language isn't set): use the team ASR, resolved like the
    // vernacular so one without a language (e.g. after the team language
    // changed) gets the team language rather than none. The team ASR
    // describes the team's language, never a project that differs.
    const usesTeamAsr =
      !hasStepLang &&
      !projectOwnsAsr &&
      Boolean(normalizeAsrState(getOrgDefault(orgDefaultAsr, orgId)));
    if (usesTeamAsr || !artifactTypeId) {
      return buildVernacularAsrState(
        settings,
        getOrgDefault,
        orgId,
        defaultAsrState,
        projectLang,
        token
      );
    }
    return buildWorkflowAsrStateFromSettings({
      settings,
      slugFromId,
      getOrgDefault,
      orgId,
      asrDefault: defaultAsrState,
      projectLang,
      token,
    });
    // slugFromId, getOrgDefault, getProjectDefault, usesProjectAsr and
    // savedProjectAsrApplies are recreated every render. Including them makes
    // getAsrSettings change every render and the load effect restarts. Team and
    // project defaults are read from memory when called; useAsrDefaultsVersion
    // tells loaders when to call again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgSteps, currentstep, orgId, projectLang, token]);

  /**
   * Whether the current user may save ASR settings as the team (org) default:
   * an admin (online) whose org default language is either unset or matches the
   * project language.
   */
  const canSetTeamAsrDefault = (): boolean => {
    if (!canSetOrgDefault) return false;
    const orgLang = getOrgDefault(orgDefaultLangProps, orgId) as
      ILanguage | undefined;
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
    // Set the language first: a change clears the old language's team ASR,
    // which the new choice then replaces.
    if (vernacular && isLangSet(vernacular.bcp47)) {
      setTeamLanguage(vernacular, orgId);
    }
    setOrgDefault(orgDefaultAsr, asrState, orgId);
    // Drop any per-project choice so the new team default isn't shadowed.
    setProjectDefault(orgDefaultAsr, undefined);
  };

  /**
   * Remember the ASR settings a Run used, on the project, when the project's
   * language differs from the team's. Otherwise the team default applies and
   * nothing is saved.
   */
  const saveProjectAsrSettings = (asrState: IAsrState) => {
    const step = orgSteps.find((s) => s.id === currentstep);
    const json = JSONParse(step?.attributes?.tool ?? '{}') as Record<
      string,
      string
    >;
    if (!usesProjectAsr(parseStepSettings(json?.settings))) return;
    const existing = normalizeAsrState(getProjectDefault(orgDefaultAsr));
    if (existing && asrStatesEqual(existing, asrState)) return;
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
      orgId,
      token
    );
  };
  /**
   * ASR for a step that does not use the vernacular, saved on the step its
   * settings are read from (e.g. the upstream recording step for LWC).
   */
  const saveStepAsrSettings = (
    asrState: IAsrState,
    stepId: string | undefined
  ) => {
    const { step, json, settings } = stepTool(stepId);
    if (!step) return;
    json.settings = JSON.stringify(
      stepSettingsFromAsrState(settings, asrState)
    );
    step.attributes.tool = JSON.stringify(json);
    void memory.update((t) => UpdateRecord(t, step, user));
  };

  return {
    getAsrSettings,
    getVernacularLanguage,
    getCachedSisterRecommendations,
    getCachedStepSisterRecommendations,
    saveSisterRecommendations,
    saveStepSisterRecommendations,
    canSetOrgDefault,
    canSetTeamAsrDefault,
    saveTeamAsrSettings,
    saveProjectAsrSettings,
    saveStepAsrSettings,
    hasTranscribeStepLanguageSettings: hasTranscribeStepLanguageSettingsHook,
    transcribeSettingsNeedSisterLanguage:
      transcribeSettingsNeedSisterLanguageHook,
  };
}
