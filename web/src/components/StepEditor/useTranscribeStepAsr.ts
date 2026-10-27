import { useContext, useEffect, useRef, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { ArtifactTypeSlug } from '../../crud/artifactTypeSlug';
import type { ILanguage } from '../../control/Language';
import { TokenContext } from '../../context/TokenProvider';
import { useGlobal } from '../../context/useGlobal';
import { JSONParse } from '../../utils/jsonParse';
import { isLangSet } from '../../utils/langTag';
import { logError, Severity } from '../../utils/logErrorService';
import { toError } from '../../utils/toError';
import {
  explicitAsrMethod,
  isValidAsrLanguage,
  isoFromBcp47,
  needsSisterLanguage,
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

const emptyLanguage = (): ILanguage => ({
  bcp47: 'und',
  languageName: '',
  font: '',
  rtl: false,
  spellCheck: false,
});

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
  vernacularLanguage,
}: {
  org: string;
  toolSettings: string;
  onChange: (toolSettings: string) => void;
  primaryBcp47: string;
  currentSlug: string;
  /** The team language, for Vernacular, Q&A and Retell steps. */
  vernacularLanguage: ILanguage;
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

  const [showSisterLanguage, setShowSisterLanguage] = useState(false);
  useEffect(() => {
    if (offlineOnly) return;
    let cancelled = false;
    needsSisterLanguage(primaryBcp47, token)
      .then((needed) => {
        if (!cancelled) setShowSisterLanguage(needed);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logError(Severity.error, errorReporter, toError(err));
        showMessage(tt.asrRequestFailed);
      });
    return () => {
      cancelled = true;
    };
    // showMessage is a new function every render. Listing it re-ran this check
    // on every render, and while aero failed each error re-rendered and asked
    // again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineOnly, primaryBcp47, token, errorReporter, tt.asrRequestFailed]);

  /**
   * The ASR language saved on the team: the chosen sister, else the team
   * language itself, unless it needs a sister that hasn't been picked yet.
   */
  const teamAsrLanguage = (chosen: ILanguage | undefined): ILanguage => {
    if (chosen && isLangSet(chosen.bcp47)) return chosen;
    if (showSisterLanguage) return emptyLanguage();
    return vernacularLanguage;
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
        save({ ...reset, language: emptyLanguage(), asrIso: 'und' });
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
