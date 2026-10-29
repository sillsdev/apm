import { useContext, useRef } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { ArtifactTypeSlug } from '../../crud/artifactTypeSlug';
import type { ILanguage } from '../../control/Language';
import { initLang } from '../../control/initLang';
import { TokenContext } from '../../context/TokenProvider';
import { useGlobal } from '../../context/useGlobal';
import { JSONParse } from '../../utils/jsonParse';
import { isLangSet } from '../../utils/langTag';
import { logError, Severity } from '../../utils/logErrorService';
import { toError } from '../../utils/toError';
import { explicitAsrMethod } from '../../business/asr/asrMethod';
import {
  isValidAsrLanguage,
  isoFromBcp47,
} from '../../business/asr/asrLanguages';
import { AsrTarget } from '../../business/asr/AsrTarget';
import type { ITranscriberStrings } from '../../model';
import { transcriberSelector } from '../../selector';
import { orgDefaultAsr, useOrgDefaults } from '../../crud/useOrgDefaults';
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
  const [errorReporter] = useGlobal('errorReporter');
  const [offlineOnly] = useGlobal('offlineOnly');
  const token = useContext(TokenContext)?.state?.accessToken ?? null;
  const tt: ITranscriberStrings = useSelector(
    transcriberSelector,
    shallowEqual
  );
  const sisterChangeRequest = useRef(0);

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
   * Only a sister is saved as the team's ASR language. With none, transcription
   * resolves the team language itself, or asks for a sister when the service
   * can't transcribe it. Saving the team language here could store one the
   * service rejects (e.g. before the sister check has answered).
   */
  const teamAsrLanguage = (chosen: ILanguage | undefined): ILanguage =>
    chosen && isLangSet(chosen.bcp47) && chosen.bcp47 !== primaryBcp47
      ? chosen
      : initLang;

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

  /** Validate a new sister language with the service, then save it. */
  const saveSister = (next: IAsrState) => {
    const bcp47 = next.language?.bcp47 ?? 'und';
    // A new language starts on the service default method, without transliterate.
    const reset = { ...next, asrMethod: undefined, selectRoman: false };
    const requestId = ++sisterChangeRequest.current;
    const check = isLangSet(bcp47)
      ? isValidAsrLanguage(isoFromBcp47(bcp47), token)
      : Promise.resolve(true);
    check
      .then((valid) => {
        if (requestId !== sisterChangeRequest.current) return;
        if (valid) {
          save(reset);
          return;
        }
        showMessage(tt.invalidSisterLang);
        save({ ...reset, language: initLang, asrIso: 'und' });
      })
      .catch((err: unknown) => {
        if (requestId !== sisterChangeRequest.current) return;
        logError(Severity.error, errorReporter, toError(err));
        showMessage(tt.asrRequestFailed);
      });
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
    if (langChanged) saveSister(next);
    else save(next);
  };

  return { asr, setAsr, showSisterLanguage };
}
