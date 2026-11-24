import { useEffect, useMemo, useState, useCallback } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import {
  OrganizationD,
  IWsAudioPlayerStrings,
  ISharedStrings,
  ITranscriberStrings,
} from '../../../model';
import { useGetAsrSettings } from '../../../crud/useGetAsrSettings';
import { useAsrDefaultsVersion } from '../../../crud/useAsrDefaultsVersion';
import { useCheckOnline } from '../../../utils/useCheckOnline';
import { isLangSet } from '../../../utils/langTag';
import { useLocLangName } from '../../../utils/useLocLangName';
import { logError, Severity } from '../../../utils/logErrorService';
import { toError } from '../../../utils/toError';
import { useGlobal } from '../../../context/useGlobal';
import { transcriberSelector } from '../../../selector';
import { AsrTarget } from '../../../business/asr/AsrTarget';
import { IAsrState, asrStatesEqual } from '../../../business/asr/asrState';
import {
  autoTranscriptionToAppend,
  cleanAsrTranscription,
} from './autoTranscriptionToAppend';
import { useAsrForceRun } from './useAsrForceRun';

export interface UseTranscribeAsrProps {
  team: OrganizationD | undefined;
  sharedStr: ISharedStrings;
  tPlayer: IWsAudioPlayerStrings;
  showMessage: (msg: string) => void;
  /** Second arg true: replace the whole transcription (forced re-run). */
  onTextAdd: (text: string, replace?: boolean) => void;
  getCurrentText: () => string;
  /** The recording already has a transcription task to resume. */
  hasActiveTask?: boolean;
  /** The selected recording; a forced run's replace applies only to it. */
  mediaId?: string;
}

export type AsrSettingsStatus = 'loading' | 'ready' | 'failed';

/**
 * Loaded team/step ASR settings, and whether they are still loading, loaded
 * or failed to load. After a failure the last loaded settings (if any) stay.
 * One owner for desktop and mobile transcribe.
 */
export function useAsrSettings(
  team: OrganizationD | undefined,
  showMessage: (msg: string) => void
) {
  const { getAsrSettings } = useGetAsrSettings(team);
  const asrDefaults = useAsrDefaultsVersion(team?.id);
  const [errorReporter] = useGlobal('errorReporter');
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const [result, setResult] = useState<{
    status: AsrSettingsStatus;
    asrSettings?: IAsrState;
  }>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    getAsrSettings()
      .then((next) => {
        if (cancelled) return;
        setResult((prev) => ({
          status: 'ready',
          asrSettings: asrStatesEqual(prev.asrSettings, next)
            ? prev.asrSettings
            : next,
        }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logError(Severity.error, errorReporter, toError(err));
        showMessage(t.asrRequestFailed);
        setResult((prev) => ({ ...prev, status: 'failed' }));
      });
    return () => {
      cancelled = true;
    };
    // showMessage is a new function every render. Listing it restarts this
    // load on every keystroke. asrDefaults is not read; it reloads after a
    // team or project default is saved.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAsrSettings, asrDefaults, errorReporter, t.asrRequestFailed]);

  return result;
}

export function useTranscribeAsr({
  team,
  sharedStr,
  tPlayer,
  showMessage,
  onTextAdd,
  getCurrentText,
  hasActiveTask = false,
  mediaId,
}: UseTranscribeAsrProps) {
  const [getName] = useLocLangName();
  const checkOnline = useCheckOnline(tPlayer.recognizeSpeech);
  const { asrSettings, status: asrStatus } = useAsrSettings(team, showMessage);

  const [progressVisible, setProgressVisible] = useState(false);
  const [asrLangVisible, setAsrLangVisible] = useState(false);
  const [asrOverride, setAsrOverride] = useState<IAsrState | undefined>(
    undefined
  );
  const {
    forceAsr,
    clearForceAsr,
    replaceAsr,
    clearReplaceAsr,
    snapshotAsrAtOpen,
    applyForceFromClosedAsr,
  } = useAsrForceRun(asrSettings, mediaId);
  const phonetic = (asrOverride ?? asrSettings)?.target === AsrTarget.phonetic;

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

  const setAsrProgressVisible = useCallback(
    (visible: boolean) => {
      if (!visible) clearForceAsr();
      setProgressVisible(visible);
    },
    [clearForceAsr]
  );

  const startAsr = useCallback((asrOverrideState?: IAsrState) => {
    setAsrOverride(asrOverrideState);
    setProgressVisible(true);
  }, []);

  const openAsrLanguageSettings = useCallback(() => {
    snapshotAsrAtOpen();
    setAsrLangVisible(true);
  }, [snapshotAsrAtOpen]);

  const handleTranscribe = useCallback(() => {
    checkOnline((online) => {
      if (!online) {
        showMessage(sharedStr.mustBeOnline);
        return;
      }
      if (hasActiveTask) {
        clearForceAsr();
        startAsr(asrSettings);
        return;
      }
      // No task to resume, so no forced result is still to come.
      clearReplaceAsr();
      if (asrSettings && isLangSet(asrSettings.asrIso)) {
        clearForceAsr();
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
    clearForceAsr,
    clearReplaceAsr,
    openAsrLanguageSettings,
  ]);

  const handleAsrLanguageClose = useCallback(
    (cancel: boolean, asrState?: IAsrState) => {
      setAsrLangVisible(false);
      if (cancel) return;
      const asr = asrState ?? asrSettings;
      if (!hasActiveTask) clearReplaceAsr();
      applyForceFromClosedAsr(asr);
      if (asr && isLangSet(asr.asrIso)) startAsr(asr);
    },
    [
      asrSettings,
      hasActiveTask,
      clearReplaceAsr,
      applyForceFromClosedAsr,
      startAsr,
    ]
  );

  const handleAutoTranscribe = useCallback(
    (trans: string) => {
      // Settings changed for this task (TT-7856): its result replaces the
      // earlier one, even when resumed after the progress dialog was closed.
      if (replaceAsr) {
        const cleaned = cleanAsrTranscription(trans);
        if (cleaned) onTextAdd(cleaned, true);
        return;
      }
      const added = autoTranscriptionToAppend(trans, getCurrentText());
      if (added !== undefined) onTextAdd(added);
    },
    [replaceAsr, getCurrentText, onTextAdd]
  );

  return {
    asrSettings,
    asrStatus,
    asrTip,
    asrProgressVisible: progressVisible,
    setAsrProgressVisible,
    asrLangVisible,
    openAsrLanguageSettings,
    asrOverride,
    forceAsr,
    replaceAsr,
    phonetic,
    handleTranscribe,
    handleAsrLanguageClose,
    handleAutoTranscribe,
  };
}
