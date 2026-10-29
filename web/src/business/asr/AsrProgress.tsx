import * as React from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { TokenContext } from '../../context/TokenProvider';
import { IAsrState } from './asrState';
import { axiosGet, axiosPost } from '../../utils/axios';
import { AxiosError } from 'axios';
import { findRecord } from '../../crud/tryFindRecord';
import { AlertSeverity, useSnackBar } from '../../hoc/SnackBar';
import { remoteId } from '../../crud/remoteId';
import { RecordKeyMap } from '@orbit/records';
import { useGlobal } from '../../context/useGlobal';
import { useOrbitData } from '../../hoc/useOrbitData';
import { Button, ActionRow } from '../../control';
import {
  ICardsStrings,
  ISharedStrings,
  IMainStrings,
  ITranscriberStrings,
  MediaFileD,
} from '../../model';
import {
  getSegments,
  getSortedRegions,
  NamedRegions,
  updateSegments,
} from '../../utils/namedSegments';
import { shallowEqual, useSelector } from 'react-redux';
import {
  cardsSelector,
  mainSelector,
  sharedSelector,
  transcriberSelector,
} from '../../selector';
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
  aeroProgressPercent,
  clipTranscription,
  parseAeroTranscriptionPoll,
  transcriptionText,
  verseFromLabel,
} from './aeroTranscriptionPoll';
import { Stack, Typography } from '@mui/material';
import { ignoreVs } from '../../utils/ignoreVs';
import { infoMsg, logError, Severity } from '../../utils';
import { useGetAsrSettings } from '../../crud/useGetAsrSettings';
import { asrMethodDefaultValue, asrRequestMethod } from './asrMethod';
import { cachedAsrMethods } from './asrLanguages';
import { useProjectSegmentSave } from '../../components/PassageDetail/Internalization/useProjectSegmentSave';
import {
  AiEstimateKey,
  estimateAiSeconds,
  recordAiSample,
} from '../../control/estimateAiTime';
import AiTimeProgress from '../../components/AiTimeProgress';

/** `key` is set only when this session started the request; a task resumed
 * after a restart has no known start, so it gets no estimate or sample. */
interface AsrRun {
  startedAt: number;
  key?: AiEstimateKey;
}

interface AsrProgressProps {
  mediaId: string;
  phonetic: boolean;
  asrState?: IAsrState | undefined;
  force?: boolean | undefined;
  contentVerses?: string[] | undefined;
  setTranscription: (transcription: string) => void;
  onPullTasks: (mediaId: string) => void;
  onClose: () => void;
}

export default function AsrProgress({
  mediaId,
  phonetic,
  asrState,
  force,
  contentVerses,
  setTranscription,
  onPullTasks,
  onClose,
}: AsrProgressProps) {
  const addingRef = React.useRef(false);
  const [working, setWorking] = React.useState(false);
  const { getAsrSettings } = useGetAsrSettings();
  const projectSegmentSave = useProjectSegmentSave();
  const [memory] = useGlobal('memory');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const token = React.useContext(TokenContext)?.state?.accessToken ?? '';
  const { showMessage } = useSnackBar();
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
  const timerDelay = 5000; //5 seconds
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const tc: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const tm: IMainStrings = useSelector(mainSelector, shallowEqual);
  const [errorReporter] = useGlobal('errorReporter');

  const loadVerseTimings = (mediaRec: MediaFileD | undefined) => {
    const segs = getSortedRegions(
      getSegments(NamedRegions.Verse, mediaRec?.attributes?.segments || '{}')
    );
    verseTimingsRef.current = segs
      .map((region) => ({
        start: region.start,
        verse: verseFromLabel(region.label),
      }))
      .filter((v) => v.verse);
  };

  const storedTaskId = (mediaRec: MediaFileD | undefined) => {
    const regionstr = getSegments(
      NamedRegions.TRTask,
      mediaRec?.attributes?.segments || '{}'
    );
    const segs = JSON.parse(regionstr ?? '{}');
    const label = segs?.regions?.[0]?.label;
    if (typeof label !== 'string') return '';
    return label.split('|')[0] ?? '';
  };

  const setTaskId = (taskId: string) => {
    setTaskIdx(taskId);
    taskIdRef.current = taskId;
    if (taskId === '') {
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
    const text = clipTranscription(
      clip,
      phonetic,
      verseTimingsRef.current,
      contentVerses
    );
    if (!text) return;
    appliedKeysRef.current.add(key);
    setTranscription(text);
  };

  const checkTask = async () => {
    const current = taskIdRef.current;
    if (!current || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const response: any = await axiosGet(
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
      //console.log(`${current} not done`, response);
      setWorking(true);
    } catch (errResult: unknown) {
      await showTaskFailure(axiosErrorMessage(errResult));
    } finally {
      checkingRef.current = false;
    }
  };

  const launchTimer = () => {
    taskTimer.current = setInterval(() => {
      checkTask();
    }, timerDelay);
  };

  const closing = () => {
    if (taskTimer.current) {
      clearInterval(taskTimer.current);
    }
    setTranscribing(false);
    setWorking(false);
    onClose && onClose();
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
    const asr = asrState ?? (await getAsrSettings());
    const iso = asr?.asrIso ?? 'eng';
    const romanize = asr?.selectRoman ?? false;
    const method = asrRequestMethod(
      asr?.asrMethod,
      phonetic,
      cachedAsrMethods(iso)
    );
    const phoneticParam = phonetic ? '?phonetic=true' : '';
    setRun({ startedAt: Date.now(), key: timingKey(method) });
    try {
      const response = (await axiosPost(
        `mediafiles/${remId}/transcription/${iso}/${romanize}${method ? `/${method}` : ''}${phoneticParam}`,
        undefined,
        token
      )) as { data: { data: MediaFileD } };
      const mediaRec = response?.data.data as MediaFileD;
      loadVerseTimings(mediaRec);
      appliedKeysRef.current = new Set();
      cleanupErrorShownRef.current = false;
      const nextTaskId = storedTaskId(mediaRec);
      if (nextTaskId) {
        onPullTasks(remId);
        setTaskId(nextTaskId);
      } else {
        status(t.aiAsrFailed);
        closing();
      }
    } catch (errResult: unknown) {
      const error = errResult as AxiosError;
      const message = axiosErrorMessage(errResult);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  React.useEffect(() => {
    if (addingRef.current) return;
    setTranscribing(true);
    setWorking(false);
    const mediaRec = findRecord(memory, 'mediafile', mediaId) as MediaFileD;
    loadVerseTimings(mediaRec);
    appliedKeysRef.current = new Set();
    cleanupErrorShownRef.current = false;
    const storedId = storedTaskId(mediaRec);
    if (
      !storedId &&
      ignoreVs((mediaRec?.attributes?.transcription ?? '').trim())
    ) {
      status(t.transcriptionExists);
      closing();
    } else if (storedId && !force) {
      setTaskId(storedId);
    } else {
      postTranscribe();
    }

    return () => {
      if (taskTimer.current) {
        clearInterval(taskTimer.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const aiDuration = React.useMemo(
    () => mediafiles.find((m) => m.id === mediaId)?.attributes?.duration ?? 0,
    [mediafiles, mediaId]
  );
  const estimateSec = React.useMemo(
    () =>
      run.key && aiDuration > 0
        ? estimateAiSeconds(run.key, aiDuration)
        : undefined,
    [run.key, aiDuration]
  );
  const hasClipProgress = Boolean(pollProgress && pollProgress.total > 0);

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
      }}
    >
      <Stack spacing={1} sx={{ width: '100%', maxWidth: '100%', minWidth: 0 }}>
        {pollProgress && hasClipProgress ? (
          <>
            <LinearProgress
              id="asr-clip-progress"
              variant="determinate"
              value={aeroProgressPercent(pollProgress)}
            />
            <Typography id="asr-progress-count">
              {pollProgress.completed}/{pollProgress.total}
            </Typography>
          </>
        ) : (
          <AiTimeProgress
            estimateSec={estimateSec}
            startedAt={run.startedAt}
            textId="asr-time-estimate"
          />
        )}
        {pollClip && (
          <Box id="asr-clip-0">
            <Typography>
              {[pollClip.clip, pollClip.state].filter(Boolean).join(' — ')}
            </Typography>
            {pollClip.state === 'FAILURE' && (
              <Typography color="error">
                {aeroErrorMessage(pollClip.error) ?? t.aiAsrFailed}
              </Typography>
            )}
            {pollClip.state === 'SUCCESS' &&
              pollClip.segments.map((segment, segIx) => (
                <Typography
                  key={`${segment.start}-${segIx}`}
                  id={`asr-segment-0-${segIx}`}
                >
                  {transcriptionText(segment.transcription, phonetic) ?? ''}
                </Typography>
              ))}
          </Box>
        )}
        {(working || Boolean(taskId)) && (
          <Typography
            sx={{
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {t.aiWillContinue.replace(/\{0\}/g, tc.recognizeSpeech)}
          </Typography>
        )}
        <ActionRow>
          <Button onClick={closing}>{ts.close}</Button>
        </ActionRow>
      </Stack>
    </Box>
  );
}
