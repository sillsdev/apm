import * as React from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { AxiosError } from 'axios';
import { RecordKeyMap } from '@orbit/records';
import IndexedDBSource from '@orbit/indexeddb';
import JSONAPISource from '@orbit/jsonapi';
import { TokenContext } from '../../context/TokenProvider';
import { useGlobal } from '../../context/useGlobal';
import { findRecord } from '../../crud/tryFindRecord';
import { pullTableList } from '../../crud/pullTableList';
import { remoteId } from '../../crud/remoteId';
import { useGetAsrSettings } from '../../crud/useGetAsrSettings';
import { useProjectSegmentSave } from '../../components/PassageDetail/Internalization/useProjectSegmentSave';
import { AlertSeverity, useSnackBar } from '../../hoc/SnackBar';
import {
  getSegments,
  getSortedRegions,
  NamedRegions,
  updateSegments,
} from '../../utils/namedSegments';
import { ignoreVs } from '../../utils/ignoreVs';
import { infoMsg, logError, Severity } from '../../utils';
import { axiosGet, axiosPost } from '../../utils/axios';
import { IMainStrings, ITranscriberStrings, MediaFileD } from '../../model';
import { mainSelector, transcriberSelector } from '../../selector';
import { AiEstimateKey, recordAiSample } from '../../control/estimateAiTime';
import AeroTaskErrorMessage from './AeroTaskErrorMessage';
import {
  aeroErrorMessage,
  aeroTaskErrorParts,
  axiosErrorMessage,
  transcriptionPollError,
} from './aeroTaskError';
import {
  AeroPollClip,
  AeroProgress,
  AeroVerseTiming,
  clipTranscription,
  parseAeroTranscriptionPoll,
  transcriptionText,
  verseFromLabel,
} from './aeroTranscriptionPoll';
import { IAsrState } from './asrState';
import { asrMethodDefaultValue, asrRequestMethod } from './asrMethod';
import { cachedAsrMethods } from './asrLanguages';

const TIMER_DELAY_MS = 5000;

/** `key` is set only when this session started the request; a task resumed
 * after a restart has no known start, so it gets no estimate or sample. */
export interface AsrRun {
  startedAt: number;
  key?: AiEstimateKey;
}

function storedTaskId(mediaRec: MediaFileD | undefined): string {
  const regionstr = getSegments(
    NamedRegions.TRTask,
    mediaRec?.attributes?.segments || '{}'
  );
  const segs = JSON.parse(regionstr ?? '{}');
  const label = segs?.regions?.[0]?.label;
  if (typeof label !== 'string') return '';
  return label.split('|')[0] ?? '';
}

function loadVerseTimings(mediaRec: MediaFileD | undefined): AeroVerseTiming[] {
  const segs = getSortedRegions(
    getSegments(NamedRegions.Verse, mediaRec?.attributes?.segments || '{}')
  );
  return segs
    .map((region) => ({
      start: region.start,
      verse: verseFromLabel(region.label),
    }))
    .filter((v) => v.verse);
}

/**
 * Submit, poll, apply clips, and clean up an Aero transcription task.
 * Presentation stays in AsrProgress.
 */
export function useAsrTaskLifecycle({
  mediaId,
  phonetic,
  asrState,
  force,
  contentVerses,
  setTranscription,
  forceRefresh,
  onClose,
}: {
  mediaId: string;
  phonetic: boolean;
  asrState?: IAsrState;
  force?: boolean;
  contentVerses?: string[];
  setTranscription: (transcription: string) => void;
  forceRefresh?: () => void;
  onClose: () => void;
}) {
  const addingRef = React.useRef(false);
  const [working, setWorking] = React.useState(false);
  const { getAsrSettings } = useGetAsrSettings();
  const projectSegmentSave = useProjectSegmentSave();
  const [memory] = useGlobal('memory');
  const [coordinator] = useGlobal('coordinator');
  const [errorReporter] = useGlobal('errorReporter');
  const token = React.useContext(TokenContext)?.state?.accessToken ?? '';
  const { showMessage } = useSnackBar();
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const tm: IMainStrings = useSelector(mainSelector, shallowEqual);

  const [taskId, setTaskIdx] = React.useState('');
  const taskIdRef = React.useRef('');
  const [pollProgress, setPollProgress] = React.useState<AeroProgress>();
  const [pollClip, setPollClip] = React.useState<AeroPollClip>();
  const [run, setRunx] = React.useState<AsrRun>(() => ({
    startedAt: Date.now(),
  }));
  const runRef = React.useRef(run);
  const verseTimingsRef = React.useRef<AeroVerseTiming[]>([]);
  const appliedKeysRef = React.useRef<Set<string>>(new Set());
  const cleanupErrorShownRef = React.useRef(false);
  const taskTimer = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const checkingRef = React.useRef(false);

  const remote = coordinator?.getSource('remote') as JSONAPISource | undefined;
  const backup = coordinator?.getSource('backup') as
    IndexedDBSource | undefined;

  const setTaskId = (nextTaskId: string) => {
    setTaskIdx(nextTaskId);
    taskIdRef.current = nextTaskId;
    if (nextTaskId === '') {
      setPollProgress(undefined);
      setPollClip(undefined);
    }
  };
  const setRun = (next: AsrRun) => {
    setRunx(next);
    runRef.current = next;
  };
  const recordRun = () => {
    const { key, startedAt } = runRef.current;
    const mediaRec = findRecord(memory, 'mediafile', mediaId) as
      MediaFileD | undefined;
    const durationSec = mediaRec?.attributes?.duration ?? 0;
    if (!key || durationSec <= 0) return;
    recordAiSample(key, {
      durationSec,
      totalMs: Date.now() - startedAt,
      at: startedAt,
    });
    // A failed cleanup keeps polling; don't record the same run twice.
    setRun({ startedAt });
  };
  const setTranscribing = (adding: boolean) => {
    addingRef.current = adding;
  };

  const status = (
    message: string | React.JSX.Element,
    alert?: AlertSeverity,
    logMessage?: string
  ) => {
    showMessage(message, alert);
    console.log(logMessage ?? (typeof message === 'string' ? message : ''));
  };

  const clearTrTasks = async () => {
    const mediaRec = findRecord(memory, 'mediafile', mediaId) as
      MediaFileD | undefined;
    if (!mediaRec) throw new Error('Mediafile not found');
    const segments = updateSegments(
      NamedRegions.TRTask,
      mediaRec.attributes?.segments ?? '[]',
      ''
    );
    await projectSegmentSave({ media: mediaRec, segments });
  };

  const finishRun = async () => {
    await clearTrTasks();
    setTaskId('');
  };

  const reportCleanupFailure = (err: unknown) => {
    logError(Severity.error, errorReporter, err as Error);
    if (cleanupErrorShownRef.current) return;
    cleanupErrorShownRef.current = true;
    const message = axiosErrorMessage(err);
    const { summary, details } = aeroTaskErrorParts(message, t.aiAsrFailed);
    status(
      <AeroTaskErrorMessage
        summary={summary}
        details={details}
        detailsLabel={tm.details}
      />,
      AlertSeverity.Error,
      message
    );
  };

  const showTaskFailure = async (message: string) => {
    const { summary, details } = aeroTaskErrorParts(message, t.aiAsrFailed);
    logError(Severity.error, errorReporter, new Error(message));
    status(
      <AeroTaskErrorMessage
        summary={summary}
        details={details}
        detailsLabel={tm.details}
      />,
      AlertSeverity.Error,
      message
    );
    try {
      await finishRun();
    } catch (err) {
      reportCleanupFailure(err);
    }
  };

  const applyClip = (clip: AeroPollClip | undefined) => {
    if (clip?.state !== 'SUCCESS') return;
    const key = clip.clip || 'clip';
    if (appliedKeysRef.current.has(key)) return;
    // Forced replace overwrites the whole transcription; skipping completed
    // verses would drop them (partial) or empty the result (fully transcribed).
    const text = clipTranscription(
      clip,
      phonetic,
      verseTimingsRef.current,
      force ? undefined : contentVerses
    );
    if (!text) return;
    appliedKeysRef.current.add(key);
    setTranscription(text);
  };

  const closing = () => {
    if (taskTimer.current) {
      clearInterval(taskTimer.current);
    }
    setTranscribing(false);
    setWorking(false);
    onClose?.();
  };

  const checkTask = async () => {
    const current = taskIdRef.current;
    if (!current || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const response: unknown = await axiosGet(
        `aero/transcription/${current}`,
        undefined,
        token
      );
      const pollError = transcriptionPollError(response);
      if (pollError) {
        await showTaskFailure(pollError);
        return;
      }
      const parsed = parseAeroTranscriptionPoll(response);
      setPollProgress(parsed.progress);
      setPollClip(parsed.clip);
      applyClip(parsed.clip);
      if (parsed.failed) {
        await showTaskFailure(
          aeroErrorMessage(parsed.clip?.error) ??
            aeroErrorMessage(parsed.error) ??
            t.aiAsrFailed
        );
        return;
      }
      if (parsed.terminal) {
        recordRun();
        const hasText = parsed.clip?.segments.some(
          (seg) =>
            (transcriptionText(seg.transcription, phonetic) ?? '').trim()
              .length > 0
        );
        if (!hasText) status(t.noAsrTranscription);
        try {
          await finishRun();
        } catch (err) {
          reportCleanupFailure(err);
          setWorking(true);
        }
        return;
      }
      setWorking(true);
    } catch (error_: unknown) {
      await showTaskFailure(axiosErrorMessage(error_));
    } finally {
      checkingRef.current = false;
    }
  };

  const launchTimer = () => {
    taskTimer.current = setInterval(() => {
      void checkTask();
    }, TIMER_DELAY_MS);
  };

  /**
   * Timing history for this run: phonetic, the chosen method, or the service
   * default. Not looked up, so the request isn't delayed for an estimate.
   */
  const timingKey = (method: string | undefined): AiEstimateKey => {
    if (phonetic) return 'transcription:phonetic';
    return `transcription:${method ?? asrMethodDefaultValue}`;
  };

  const postTranscribe = async () => {
    const remId =
      remoteId('mediafile', mediaId, memory?.keyMap as RecordKeyMap) ?? mediaId;
    try {
      const asr = asrState ?? (await getAsrSettings());
      const iso = asr?.asrIso ?? 'eng';
      const romanize = asr?.selectRoman ?? false;
      const method = asrRequestMethod(
        asr?.asrMethod,
        phonetic,
        cachedAsrMethods(iso)
      );
      const phoneticParam = phonetic ? '?phonetic=true' : '';
      const methodPath = method ? `/${method}` : '';
      setRun({ startedAt: Date.now(), key: timingKey(method) });
      const response = (await axiosPost(
        `mediafiles/${remId}/transcription/${iso}/${romanize}${methodPath}${phoneticParam}`,
        undefined,
        token
      )) as { data: { data: MediaFileD } };
      const mediaRec = response?.data.data as MediaFileD;
      appliedKeysRef.current = new Set();
      cleanupErrorShownRef.current = false;
      const nextTaskId = storedTaskId(mediaRec);
      if (nextTaskId) {
        if (remote && backup) {
          void pullTableList(
            'mediafile',
            [remId],
            memory,
            remote,
            backup,
            errorReporter
          ).then(() => forceRefresh?.());
        }
        setTaskId(nextTaskId);
      } else {
        status(t.aiAsrFailed);
        closing();
      }
    } catch (error_: unknown) {
      const error = error_ as AxiosError;
      const message = axiosErrorMessage(error_);
      const { summary, details } = aeroTaskErrorParts(message, t.aiAsrFailed);
      logError(
        Severity.error,
        errorReporter,
        infoMsg(error, summary + (details ? `: ${details}` : ''))
      );
      try {
        await clearTrTasks();
      } catch (err) {
        logError(Severity.error, errorReporter, err as Error);
      }
      status(
        <AeroTaskErrorMessage
          summary={summary || t.aiAsrFailed}
          details={details}
          detailsLabel={tm.details}
        />,
        AlertSeverity.Error,
        message
      );
      closing();
    }
  };

  React.useEffect(() => {
    if (taskId) {
      if (!taskTimer.current) launchTimer();
    } else if (taskTimer.current) {
      clearInterval(taskTimer.current);
      taskTimer.current = undefined;
      closing();
    }
    // Mount/start effect owns closing; including it restarts the timer loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  React.useEffect(() => {
    if (addingRef.current) return;
    setTranscribing(true);
    setWorking(false);
    const mediaRec = findRecord(memory, 'mediafile', mediaId) as MediaFileD;
    verseTimingsRef.current = loadVerseTimings(mediaRec);
    appliedKeysRef.current = new Set();
    cleanupErrorShownRef.current = false;
    const storedId = storedTaskId(mediaRec);
    if (
      !force &&
      !storedId &&
      ignoreVs((mediaRec?.attributes?.transcription ?? '').trim())
    ) {
      status(t.transcriptionExists);
      closing();
    } else if (storedId && !force) {
      setTaskId(storedId);
    } else {
      void postTranscribe();
    }

    return () => {
      if (taskTimer.current) {
        clearInterval(taskTimer.current);
      }
    };
    // One-shot mount: resume or start; deps would re-POST on every prop tweak.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    working,
    taskId,
    pollProgress,
    pollClip,
    run,
    closing,
  };
}
