import React from 'react';
import { IAsrState } from '../business/asr/AsrAlphabet';
import { OrganizationD, OrgWorkflowStepD } from '../model';
import { orgDefaultAsr, useOrgDefaults } from './useOrgDefaults';
import { useGlobal } from '../context/useGlobal';
import { PassageDetailContext } from '../context/PassageDetailContext';
import { useOrbitData } from '../hoc/useOrbitData';
import { JSONParse } from '../utils';
import { getPreferredAsrMethod } from '../business/asr/asrLanguages';
import { UpdateRecord } from '../model/baseModel';
import { AsrTarget } from '../business/asr/AsrTarget';
import { useArtifactType } from './useArtifactType';
import { ToolSlug } from './toolSlug';
import {
  buildVernacularAsrState,
  buildWorkflowAsrStateFromSettings,
  formatStepLanguageField,
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
  GetOrgDefaultFn,
  TranscribeStepSettings,
  IStepLanguageInfo,
} from './transcribeStepAsrSettings';

export function useGetAsrSettings(team?: OrganizationD) {
  const orgSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const [organization] = useGlobal('organization');
  const { getOrgDefault, setOrgDefault } = useOrgDefaults();
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
    mmsIso: 'eng',
    method: getPreferredAsrMethod('eng'),
    dialect: undefined,
    selectRoman: false,
  };

  const orgId = team?.id ?? organization;

  const parseStepSettings = (settingsJson: string | undefined) =>
    JSONParse(settingsJson ?? '{}') as TranscribeStepSettings;

  const getArtId = () => {
    const step = orgSteps.find((s) => s.id === currentstep);
    const json = JSONParse(step?.attributes?.tool ?? '{}') as Record<
      string,
      string
    >;
    const settings = parseStepSettings(json?.settings);
    return String(settings?.artifactTypeId ?? '');
  };

  const getVernacularAsrState = (settings: TranscribeStepSettings) =>
    buildVernacularAsrState(settings, getOrgDefault, orgId, asrDefault);

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
      asrDefault
    );
  };

  const getAsrSettings = () => {
    const step = orgSteps.find((s) => s.id === currentstep);
    const json = JSONParse(step?.attributes?.tool ?? '{}') as Record<
      string,
      string
    >;
    const settings = parseStepSettings(json?.settings);
    if (json.tool === ToolSlug.Transcribe) {
      if (!settings?.artifactTypeId) {
        return getVernacularAsrState(settings);
      }
      return getWorkflowAsrState();
    }
    if (!getArtId()) {
      return getOrgDefault(orgDefaultAsr, team?.id) as IAsrState;
    }
    return getWorkflowAsrState();
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

  const saveAsrSettings = (asrState: IAsrState) => {
    if (!getArtId()) {
      setOrgDefault(orgDefaultAsr, asrState, team?.id);
    } else {
      const step = orgSteps.find((s) => s.id === currentstep);
      if (!step) return;
      const json = JSONParse(step?.attributes?.tool ?? '{}') as Record<
        string,
        string
      >;
      const settings = parseStepSettings(json?.settings);
      settings.language = formatStepLanguageField(asrState.language);
      settings.font = asrState?.language.font;
      settings.rtl = asrState?.language.rtl;
      json.settings = JSON.stringify(settings);
      step.attributes.tool = JSON.stringify(json);
      memory.update((t) => UpdateRecord(t, step, user));
    }
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
    saveAsrSettings,
    saveTranscribeStepSettings,
    hasTranscribeStepLanguageSettings: hasTranscribeStepLanguageSettingsHook,
    transcribeSettingsNeedSisterLanguage:
      transcribeSettingsNeedSisterLanguageHook,
    getArtId,
  };
}
