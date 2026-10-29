import { shallowEqual, useSelector } from 'react-redux';
import { ArtifactTypeSlug } from '../../crud/artifactTypeSlug';
import type { ILanguage } from '../../control/Language';
import { initLang } from '../../control/initLang';
import { useGlobal } from '../../context/useGlobal';
import { JSONParse } from '../../utils/jsonParse';
import { isLangSet } from '../../utils/langTag';
import { explicitAsrMethod } from '../../business/asr/asrMethod';
import { isoFromBcp47 } from '../../business/asr/asrLanguages';
import { AsrTarget } from '../../business/asr/AsrTarget';
import type { ITranscriberStrings } from '../../model';
import { transcriberSelector } from '../../selector';
import {
  orgDefaultAsr,
  orgDefaultLangProps,
  useOrgDefaults,
} from '../../crud/useOrgDefaults';
import { useAsrDefaultsVersion } from '../../crud/useAsrDefaultsVersion';
import {
  artifactUsesOrgVernacularLanguage,
  stepAsrFromSettings,
  stepSettingsFromAsrState,
  teamVernacularAsr,
  type TranscribeStepSettings as ITranscribeStepSettings,
} from '../../crud/transcribeStepAsrSettings';
import type { IAsrState } from '../../business/asr/asrState';
import { useSnackBar } from '../../hoc/useSnackBar';
import { useNeedsSisterLanguage } from '../../business/asr/useNeedsSisterLanguage';

type SetAsr = (
  action: IAsrState | undefined | ((prev: IAsrState) => IAsrState | undefined)
) => void;

/**
 * The step editor's ASR box. Vernacular, Q&A and Retell steps edit the team
 * ASR default; a step with its own language (e.g. back translation) edits its
 * own settings. The box shows `asr` and reports edits through `setAsr`.
 */
export function useTranscribeStepAsr({
  org,
  toolSettings,
  onChange,
  primaryBcp47,
  currentSlug,
}: {
  org: string;
  toolSettings: string;
  onChange: (toolSettings: string) => void;
  primaryBcp47: string;
  currentSlug: string;
}) {
  const { getOrgDefault, setOrgDefault } = useOrgDefaults();
  // Re-render when the team ASR is saved: Orbit changes the record in place.
  useAsrDefaultsVersion(org);
  const { showMessage } = useSnackBar();
  const [offlineOnly] = useGlobal('offlineOnly');
  const tt: ITranscriberStrings = useSelector(
    transcriberSelector,
    shallowEqual
  );

  const usesTeamAsr = artifactUsesOrgVernacularLanguage(
    currentSlug as ArtifactTypeSlug
  );
  const settings = (JSONParse(toolSettings || '{}') ??
    {}) as ITranscribeStepSettings;
  const asr: IAsrState = usesTeamAsr
    ? (teamVernacularAsr(getOrgDefault, org, settings) ??
      stepAsrFromSettings({}))
    : stepAsrFromSettings(settings);

  const { needsSister } = useNeedsSisterLanguage(primaryBcp47, {
    enabled: !offlineOnly,
    onFailed: () => showMessage(tt.asrRequestFailed),
  });
  const showSisterLanguage = needsSister === true;

  /**
   * The ASR language saved on the team: a chosen sister; else the team
   * language itself when the service can transcribe it; else none ('und'),
   * also while the service hasn't said whether the team language needs a
   * sister, so a language it can't transcribe is never saved.
   */
  const teamAsrLanguage = (chosen: ILanguage | undefined): ILanguage => {
    if (chosen && isLangSet(chosen.bcp47) && chosen.bcp47 !== primaryBcp47) {
      return chosen;
    }
    if (needsSister !== false) return initLang;
    return (
      (getOrgDefault(orgDefaultLangProps, org) as ILanguage | undefined) ??
      initLang
    );
  };

  const save = (next: IAsrState) => {
    const phonetic = next.target === AsrTarget.phonetic;
    const cleaned: IAsrState = {
      ...next,
      asrMethod: explicitAsrMethod(next.asrMethod),
      // Transliterate only applies to script transcription.
      selectRoman: !phonetic && next.selectRoman === true,
    };
    if (usesTeamAsr) {
      const language = teamAsrLanguage(cleaned.language);
      setOrgDefault(
        orgDefaultAsr,
        { ...cleaned, language, asrIso: isoFromBcp47(language.bcp47) },
        org
      );
      return;
    }
    const json = JSON.stringify(stepSettingsFromAsrState(settings, cleaned));
    if (json !== JSON.stringify(settings)) onChange(json);
  };

  const setAsr: SetAsr = (action) => {
    const next = typeof action === 'function' ? action(asr) : action;
    if (!next) return;
    // The picker reports its current value once on mount; only a different
    // language is a change.
    const langChanged =
      (next.language?.bcp47 ?? 'und') !== (asr.language?.bcp47 ?? 'und') ||
      (next.language?.languageName ?? '') !==
        (asr.language?.languageName ?? '');
    // The picker only offers languages the service lists. A new language
    // starts on the service default method, without transliterate.
    save(
      langChanged ? { ...next, asrMethod: undefined, selectRoman: false } : next
    );
  };

  return { asr, setAsr, showSisterLanguage };
}
