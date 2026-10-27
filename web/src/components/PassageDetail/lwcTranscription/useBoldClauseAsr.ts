import { useCallback, useMemo, useState } from 'react';
import type { IAsrState } from '../../../business/asr/asrState';
import { useBoldClauseTranscriptionAsrSettings } from '../../../crud/getLwcTranslationAsrSettings';
import type { TranscribeStepSettingsJson } from '../../../crud/stepSpellCheck';
import { parseStepLanguageField } from '../../../crud/transcribeStepAsrSettings';
import { isLangSet } from '../../../utils/langTag';
import { useLocLangName } from '../../../utils/useLocLangName';
import type { BoldClauseTranscriptionConfig } from '../boldClauseTranscription';

export function parseStepSettings(
  settings: unknown
): TranscribeStepSettingsJson {
  if (!settings) return {};
  if (typeof settings === 'string') {
    try {
      return JSON.parse(settings) as TranscribeStepSettingsJson;
    } catch {
      return {};
    }
  }
  if (typeof settings === 'object') {
    return settings as TranscribeStepSettingsJson;
  }
  return {};
}

interface UseBoldClauseAsrOptions {
  transcriptionConfig: BoldClauseTranscriptionConfig;
  stepSettings: unknown;
  /** The localized "Recognize speech {0}" tooltip template. */
  recognizeSpeech: string;
}

/**
 * The ASR settings a bold-clause editor runs with: the resolved step/vernacular
 * settings, overridden by the dialog's choice for a step language.
 */
export function useBoldClauseAsr({
  transcriptionConfig,
  stepSettings,
  recognizeSpeech,
}: UseBoldClauseAsrOptions) {
  const [getName] = useLocLangName();
  const {
    asrSettings: resolvedAsr,
    asrIsoReady: resolvedAsrIsoReady,
    needsSisterLanguage: resolvedNeedsSister,
    asrLoadFailed,
    stepLanguageBcp47,
  } = useBoldClauseTranscriptionAsrSettings(
    transcriptionConfig.upstreamTool,
    transcriptionConfig.defaultArtifactSlug,
    stepSettings
  );
  // The dialog's choice for a step language (e.g. LWC translation), kept while
  // the editor is open so the dialog doesn't reopen on every clause. It isn't
  // saved: the saved project/team ASR defaults belong to the vernacular.
  const [stepAsrChoice, setStepAsrChoice] = useState<{
    forBcp47: string;
    asr: IAsrState;
  }>();
  const chosenStepAsr =
    stepLanguageBcp47 && stepAsrChoice?.forBcp47 === stepLanguageBcp47
      ? stepAsrChoice.asr
      : undefined;
  const asrSettings = chosenStepAsr ?? resolvedAsr;
  const asrIsoReady = chosenStepAsr ? true : resolvedAsrIsoReady;
  const needsLanguagePicker =
    !asrIsoReady || (!chosenStepAsr && resolvedNeedsSister());

  /** Remember a step-language choice so the dialog reopens on it. */
  const rememberStepAsr = useCallback(
    (asr: IAsrState) => {
      if (stepLanguageBcp47) {
        setStepAsrChoice({ forBcp47: stepLanguageBcp47, asr });
      }
    },
    [stepLanguageBcp47]
  );

  const stepAsr = useMemo(
    () =>
      stepLanguageBcp47
        ? { primaryBcp47: stepLanguageBcp47, asr: asrSettings }
        : undefined,
    [stepLanguageBcp47, asrSettings]
  );

  const asrTip = useMemo(() => {
    const step = parseStepSettings(stepSettings);
    const primary = parseStepLanguageField(step.language);
    const sister = parseStepLanguageField(step.sisterlanguage);
    const asrBcp = asrSettings?.language?.bcp47;
    const primaryBcp = isLangSet(primary.bcp47) ? primary.bcp47 : asrBcp;
    const primaryName = primaryBcp
      ? getName(primaryBcp) ||
        primary.languageName ||
        asrSettings?.language?.languageName
      : asrSettings?.language?.languageName;
    const usingSister =
      isLangSet(sister.bcp47) &&
      isLangSet(asrBcp) &&
      asrBcp === sister.bcp47 &&
      asrBcp !== primaryBcp;
    let langPart = primaryName?.trim() ? `‹ ${primaryName.trim()} ›` : '';
    if (usingSister) {
      const sisterName =
        getName(sister.bcp47) ||
        sister.languageName ||
        asrSettings?.language?.languageName;
      if (sisterName?.trim()) {
        langPart += `${langPart ? ' ' : ''}‹ ${sisterName.trim()} ›`;
      }
    }
    return (recognizeSpeech + '  ').replace('{0}', langPart);
    // getName is recreated every render; the names it returns follow the
    // language codes already listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asrSettings, stepSettings, recognizeSpeech]);

  return {
    asrSettings,
    asrIsoReady,
    asrLoadFailed,
    needsLanguagePicker,
    rememberStepAsr,
    stepAsr,
    asrTip,
  };
}
