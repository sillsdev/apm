import { useEffect, useMemo, useState, useCallback } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import {
  OrganizationD,
  IWsAudioPlayerStrings,
  ISharedStrings,
  ITranscriberStrings,
} from '../../../model';
import { useGetAsrSettings } from '../../../crud/useGetAsrSettings';
import { useCheckOnline } from '../../../utils/useCheckOnline';
import { isLangSet } from '../../../utils/langTag';
import { useLocLangName } from '../../../utils/useLocLangName';
import { logError, Severity } from '../../../utils/logErrorService';
import { useGlobal } from '../../../context/useGlobal';
import { transcriberSelector } from '../../../selector';
import { AsrTarget } from '../../../business/asr/AsrTarget';
import { IAsrState, asrStatesEqual } from '../../../business/asr/asrState';

export interface UseTranscribeAsrProps {
  team: OrganizationD | undefined;
  sharedStr: ISharedStrings;
  tPlayer: IWsAudioPlayerStrings;
  showMessage: (msg: string) => void;
  onTextAdd: (text: string, isAsr?: boolean) => void;
  getCurrentText: () => string;
  /** The recording already has a transcription task to resume. */
  hasActiveTask?: boolean;
}

/** Loaded team/step ASR settings. One owner for desktop and mobile transcribe. */
export function useAsrSettings(
  team: OrganizationD | undefined,
  showMessage: (msg: string) => void
) {
  const { getAsrSettings } = useGetAsrSettings(team);
  const [errorReporter] = useGlobal('errorReporter');
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const [asrSettings, setAsrSettings] = useState<IAsrState>();

  useEffect(() => {
    let cancelled = false;
    getAsrSettings()
      .then((next) => {
        if (cancelled) return;
        setAsrSettings((prev) => (asrStatesEqual(prev, next) ? prev : next));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logError(
          Severity.error,
          errorReporter,
          err instanceof Error ? err : new Error(String(err))
        );
        showMessage(t.asrRequestFailed);
      });
    return () => {
      cancelled = true;
    };
    // showMessage is a new function every render. Listing it restarts this
    // load on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAsrSettings, errorReporter, t.asrRequestFailed]);

  return asrSettings;
}

export function useTranscribeAsr({
  team,
  sharedStr,
  tPlayer,
  showMessage,
  onTextAdd,
  getCurrentText,
  hasActiveTask = false,
}: UseTranscribeAsrProps) {
  const [getName] = useLocLangName();
  const checkOnline = useCheckOnline(tPlayer.recognizeSpeech);
  const asrSettings = useAsrSettings(team, showMessage);

  const [asrProgressVisible, setAsrProgressVisible] = useState(false);
  const [asrLangVisible, setAsrLangVisible] = useState(false);
  const [phonetic, setPhonetic] = useState(false);
  const [asrOverride, setAsrOverride] = useState<IAsrState | undefined>(
    undefined
  );

  const asrTip = useMemo(() => {
    return (tPlayer.recognizeSpeech + '\u00A0\u00A0').replace(
      '{0}',
      asrSettings?.language?.languageName?.trim()
        ? `\u2039 ${
            getName(asrSettings?.language.bcp47) ||
            asrSettings?.language?.languageName
          } \u203A`
        : ''
    );
  }, [tPlayer.recognizeSpeech, asrSettings, getName]);

  const startAsr = useCallback(
    (asrOverrideState?: IAsrState) => {
      const asr = asrOverrideState ?? asrSettings;
      setAsrOverride(asrOverrideState);
      setPhonetic(asr?.target === AsrTarget.phonetic);
      setAsrProgressVisible(true);
    },
    [asrSettings]
  );

  const openAsrLanguageSettings = useCallback(() => {
    setAsrLangVisible(true);
  }, []);

  const handleTranscribe = useCallback(() => {
    checkOnline((online) => {
      if (!online) {
        showMessage(sharedStr.mustBeOnline);
        return;
      }
      if (hasActiveTask) {
        startAsr(asrSettings);
        return;
      }
      if (asrSettings && isLangSet(asrSettings.asrIso)) {
        startAsr(asrSettings);
        return;
      }
      openAsrLanguageSettings();
    });
  }, [
    checkOnline,
    showMessage,
    sharedStr.mustBeOnline,
    hasActiveTask,
    asrSettings,
    startAsr,
    openAsrLanguageSettings,
  ]);

  const handleAsrLanguageClose = useCallback(
    (cancel: boolean, asrState?: IAsrState) => {
      setAsrLangVisible(false);
      if (cancel) return;
      const asr = asrState ?? asrSettings;
      if (asr && isLangSet(asr.asrIso)) startAsr(asr);
    },
    [asrSettings, startAsr]
  );

  const handleAutoTranscribe = useCallback(
    (trans: string) => {
      const cleanTrans = trans.replace(/\d+:\d+\.\d+: /g, '').trim();
      const curTrans = getCurrentText();
      if (curTrans.includes(cleanTrans)) return;
      const m = /\\v (\d+)\s?/.exec(cleanTrans);
      const index = m && curTrans.includes(m[0]) ? m[0].length : 0;
      const space = /\s$/.test(curTrans) ? '' : ' ';
      onTextAdd(space + cleanTrans.substring(index), true);
    },
    [getCurrentText, onTextAdd]
  );

  return {
    asrSettings,
    asrTip,
    asrProgressVisible,
    setAsrProgressVisible,
    asrLangVisible,
    setAsrLangVisible,
    asrOverride,
    phonetic,
    handleTranscribe,
    handleAsrLanguageClose,
    handleAutoTranscribe,
  };
}
