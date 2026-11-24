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
import { ignoreVs } from '../../../utils/ignoreVs';
import type { AsrResult } from '../../../business/asr/useAsrTaskLifecycle';
import type { AsrTextMode } from './insertAsrText';

export interface UseTranscribeAsrProps {
  team: OrganizationD | undefined;
  sharedStr: ISharedStrings;
  tPlayer: IWsAudioPlayerStrings;
  showMessage: (msg: string) => void;
  /** Put ASR text in the pane: replace it all, add at the end, or at the caret. */
  onTextAdd: (text: string, mode: AsrTextMode) => void;
  getCurrentText: () => string;
  /** The recording already has a transcription task to resume. */
  hasActiveTask?: boolean;
  /** The recording being transcribed; a dismissed result is kept for it. */
  mediaId?: string;
}

export type AsrSettingsStatus = 'loading' | 'ready' | 'failed';

/** A result waiting for the user to choose Replace or Insert. */
export interface AsrPrompt {
  result: AsrResult;
  onReplace: () => void;
  onInsert: () => void;
  /** Escape or a click outside: leave the pane, keep the result to offer again. */
  onDismiss: () => void;
}

/** A result and the ASR settings of the run that made it. */
interface HeldAsr {
  result: AsrResult;
  asr: IAsrState | undefined;
}

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
    snapshotAsrAtOpen,
    applyForceFromClosedAsr,
  } = useAsrForceRun(asrSettings);
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

  const [pendingAsr, setPendingAsr] = useState<HeldAsr>();
  /** A dismissed result, offered again instead of a run with the same settings. */
  const [keptAsr, setKeptAsr] = useState<HeldAsr & { mediaId?: string }>();

  /**
   * Apply an ASR result. Onto an empty pane (verse markers alone don't count)
   * it is added; onto text the user already has, ask Replace or Insert
   * (TT-7856) instead of silently duplicating or overwriting it.
   */
  const applyAsrResult = useCallback(
    (result: AsrResult, asr: IAsrState | undefined) => {
      const full = cleanAsrTranscription(result.full);
      if (!full) return;
      const current = getCurrentText();
      if (current.includes(full)) return;
      if (!ignoreVs(current)?.trim()) {
        const added = autoTranscriptionToAppend(full, current);
        if (added !== undefined) onTextAdd(added, 'end');
        return;
      }
      setPendingAsr({
        result: {
          full,
          withoutFilled: cleanAsrTranscription(result.withoutFilled),
        },
        asr,
      });
    },
    [getCurrentText, onTextAdd]
  );

  const startAsr = useCallback(
    (asrOverrideState?: IAsrState) => {
      setKeptAsr(undefined);
      if (
        keptAsr &&
        keptAsr.mediaId === mediaId &&
        asrStatesEqual(keptAsr.asr, asrOverrideState)
      ) {
        applyAsrResult(keptAsr.result, keptAsr.asr);
        return;
      }
      setAsrOverride(asrOverrideState);
      setProgressVisible(true);
    },
    [keptAsr, mediaId, applyAsrResult]
  );

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
    openAsrLanguageSettings,
  ]);

  const handleAsrLanguageClose = useCallback(
    (cancel: boolean, asrState?: IAsrState) => {
      setAsrLangVisible(false);
      if (cancel) return;
      const asr = asrState ?? asrSettings;
      applyForceFromClosedAsr(asr);
      if (asr && isLangSet(asr.asrIso)) startAsr(asr);
    },
    [asrSettings, applyForceFromClosedAsr, startAsr]
  );

  /** A result from the run that just finished. */
  const handleAutoTranscribe = useCallback(
    (result: AsrResult) => applyAsrResult(result, asrOverride ?? asrSettings),
    [applyAsrResult, asrOverride, asrSettings]
  );

  const asrPrompt = useMemo<AsrPrompt | undefined>(() => {
    if (!pendingAsr) return undefined;
    const { result } = pendingAsr;
    return {
      result,
      onReplace: () => {
        onTextAdd(result.full, 'replace');
        setPendingAsr(undefined);
      },
      onInsert: () => {
        if (result.withoutFilled) onTextAdd(result.withoutFilled, 'cursor');
        setPendingAsr(undefined);
      },
      onDismiss: () => {
        setKeptAsr({ ...pendingAsr, mediaId });
        setPendingAsr(undefined);
      },
    };
  }, [pendingAsr, onTextAdd, mediaId]);

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
    phonetic,
    handleTranscribe,
    handleAsrLanguageClose,
    handleAutoTranscribe,
    asrPrompt,
  };
}
