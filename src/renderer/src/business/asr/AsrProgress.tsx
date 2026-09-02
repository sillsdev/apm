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
import { Button, ActionRow } from '../../control';
import {
  ICardsStrings,
  ISharedStrings,
  IMainStrings,
  ITranscriberStrings,
  MediaFileD,
  PassageD,
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
  aeroTaskErrorParts,
  axiosErrorMessage,
  transcriptionPollError,
} from './aeroTaskError';
import { Stack, Typography } from '@mui/material';
import { ignoreVs } from '../../utils/ignoreVs';
import { infoMsg, logError, Severity } from '../../utils';
import { useGetAsrSettings } from '../../crud/useGetAsrSettings';
import { useProjectSegmentSave } from '../../components/PassageDetail/Internalization/useProjectSegmentSave';
import { formatAsrProgressMessage } from '../../components/PassageDetail/transcribe/asrProgressMessage';
import {
  PassageVerseSpanInput,
  passageVerseSpanFromPassage,
} from '../../components/PassageDetail/transcribe/passageVerseSpan';
import { asrDebug, asrDebugPreview } from './asrDebug';
import { useWaitForRemoteQueue } from '../../utils/useWaitForRemoteQueue';

export interface VerseTask {
  taskId: string;
  verse: string;
  complete: boolean;
}

interface AsrProgressProps {
  mediaId: string;
  phonetic: boolean;
  asrState?: IAsrState | undefined;
  force?: boolean | undefined;
  contentVerses?: string[] | undefined;
  passage?: PassageD | undefined;
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
  passage,
  setTranscription,
  onPullTasks,
  onClose,
}: AsrProgressProps) {
  const addingRef = React.useRef(false);
  const [working, setWorking] = React.useState(false);
  const { getAsrSettings } = useGetAsrSettings();
  const projectSegmentSave = useProjectSegmentSave();
  const waitForRemoteQueue = useWaitForRemoteQueue();
  const [memory] = useGlobal('memory');
  const [coordinator] = useGlobal('coordinator');
  const token = React.useContext(TokenContext)?.state?.accessToken ?? '';
  const { showMessage } = useSnackBar();
  const [taskId, setTaskIdx] = React.useState('');
  const taskIdRef = React.useRef('');
  const [tasks, setTasks] = React.useState<VerseTask[]>();
  const tasksRef = React.useRef<VerseTask[] | undefined>(undefined);
  const contentVersesRef = React.useRef(contentVerses);
  const taskTimer = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const checkingRef = React.useRef(false);
  const timerDelay = 5000; //5 seconds
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const tc: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const tm: IMainStrings = useSelector(mainSelector, shallowEqual);
  const [errorReporter] = useGlobal('errorReporter');

  const describeVerseRegions = (mediaRec: MediaFileD | undefined) => {
    const verseJson = getSegments(
      NamedRegions.Verse,
      mediaRec?.attributes?.segments || '{}'
    );
    const regions = getSortedRegions(verseJson);
    return {
      verseRegionCount: regions.length,
      verseLabels: regions.map((r) => r.label ?? ''),
      verseRanges: regions.map((r) => ({
        label: r.label ?? '',
        start: r.start,
        end: r.end,
      })),
      verseRegionPreview: asrDebugPreview(verseJson, 200),
    };
  };

  const describeTrTaskRaw = (mediaRec: MediaFileD | undefined) => {
    const regionstr = getSegments(
      NamedRegions.TRTask,
      mediaRec?.attributes?.segments || '{}'
    );
    let rawLabels: string[] = [];
    try {
      const segs = JSON.parse(regionstr ?? '{}');
      if (Array.isArray(segs?.regions)) {
        rawLabels = (segs.regions as Array<{ label?: string }>).map(
          (r) => r.label ?? ''
        );
      }
    } catch {
      rawLabels = [];
    }
    return {
      trTaskRawPreview: asrDebugPreview(regionstr, 300),
      trTaskRawLabels: rawLabels,
    };
  };

  const passageSpan: PassageVerseSpanInput | undefined = React.useMemo(
    () => passageVerseSpanFromPassage(passage),
    [passage]
  );

  React.useEffect(() => {
    asrDebug('contentVerses updated', { contentVerses });
    contentVersesRef.current = contentVerses;
  }, [contentVerses]);

  React.useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const getTasks = (mediaRec: MediaFileD | undefined) => {
    const regionstr = getSegments(
      NamedRegions.TRTask,
      mediaRec?.attributes?.segments || '{}'
    );
    const segs = JSON.parse(regionstr ?? '{}');
    const tsks: VerseTask[] = [];
    if (Array.isArray(segs?.regions)) {
      (segs?.regions as Array<any>).forEach((region) => {
        const part: string[] = region.label.split('|');
        tsks.push({
          taskId: part[0] ?? '',
          verse: part[1] ?? '', //undefined if no timing
          complete:
            contentVersesRef.current?.includes(part[1] ?? 'no-verses') ??
            false,
        });
      });
      asrDebug('getTasks', {
        mediaId,
        taskCount: tsks.length,
        contentVerses: contentVersesRef.current,
        tasks: tsks.map((t) => ({
          taskId: t.taskId,
          verse: t.verse,
          complete: t.complete,
        })),
      });
      return tsks;
    } else {
      asrDebug('getTasks', { mediaId, taskCount: 0, reason: 'no TRTask regions' });
      return undefined;
    }
  };

  const syncTasks = (tsks: VerseTask[] | undefined) => {
    tasksRef.current = tsks;
    setTasks(tsks);
  };

  const getTaskId = (
    mediaRec: MediaFileD | undefined
  ): [string | undefined, VerseTask[] | undefined] => {
    const tsks = getTasks(mediaRec);
    if (tsks && !tasksRef.current) syncTasks(tsks);
    return [tsks?.find((task) => !task.complete)?.taskId, tsks];
  };

  const setTaskId = (nextTaskId: string, reason?: string) => {
    asrDebug('setTaskId', {
      from: taskIdRef.current,
      to: nextTaskId,
      reason,
    });
    setTaskIdx(nextTaskId);
    taskIdRef.current = nextTaskId;
    if (nextTaskId === '') syncTasks(undefined);
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

  const showTaskFailure = async (message: string) => {
    asrDebug('showTaskFailure', {
      taskId: taskIdRef.current,
      message,
    });
    const { summary, details } = aeroTaskErrorParts(message, t.aiAsrFailed);
    logError(Severity.error, errorReporter, new Error(message));
    await clearTrTasks();
    status(
      <AeroTaskErrorMessage
        summary={summary}
        details={details}
        detailsLabel={tm.details}
      />,
      AlertSeverity.Error,
      message
    );
    setTaskId('', 'showTaskFailure');
  };

  const clearTrTasks = async () => {
    const mediaRec = findRecord(memory, 'mediafile', mediaId) as
      | MediaFileD
      | undefined;
    if (!mediaRec) return;
    const segments = updateSegments(
      NamedRegions.TRTask,
      mediaRec.attributes?.segments ?? '[]',
      ''
    );
    try {
      await projectSegmentSave({ media: mediaRec, segments });
    } catch (err) {
      logError(Severity.error, errorReporter, err as Error);
    }
  };

  const checkTask = React.useCallback(async () => {
    const current = taskIdRef.current;
    if (!current || checkingRef.current) {
      asrDebug('checkTask skipped', {
        taskId: current,
        checking: checkingRef.current,
      });
      return;
    }
    checkingRef.current = true;
    asrDebug('checkTask poll', { taskId: current });
    try {
      const response: any = await axiosGet(`aero/transcription/${current}`);
      const pollError = transcriptionPollError(response);
      asrDebug('checkTask response', {
        taskId: current,
        pollError,
        hasTranscription: Boolean(response?.transcription),
        transcriptionEmpty: response?.transcription === '',
        transcriptionPreview: asrDebugPreview(response?.transcription),
        responseKeys: response ? Object.keys(response) : [],
      });
      if (pollError) {
        await showTaskFailure(pollError);
        return;
      }
      if (response?.transcription) {
        let verse = '';
        let nextTask = '';
        const activeTasks = tasksRef.current;
        if (activeTasks) {
          const ix = activeTasks.findIndex((task) => task.taskId === current);
          if (ix >= 0) {
            const taskVerse = activeTasks[ix]?.verse ?? '';
            if (typeof taskVerse === 'string' && taskVerse)
              verse = ` \\v ${taskVerse} `;
            activeTasks[ix].complete = true;
            syncTasks([...activeTasks]);
            nextTask =
              ix < activeTasks.length - 1
                ? (activeTasks[ix + 1]?.taskId ?? '')
                : '';
            const alreadyHasContent =
              taskVerse &&
              (contentVersesRef.current?.includes(taskVerse) ?? false);
            asrDebug('checkTask verse complete', {
              taskId: current,
              taskIndex: ix,
              taskVerse,
              taskCount: activeTasks.length,
              nextTask: nextTask || '(none — all tasks done)',
              alreadyHasContent,
              willApplyTranscription: !alreadyHasContent,
              chunkPreview: asrDebugPreview(verse + response?.transcription),
            });
            if (!alreadyHasContent) {
              setTranscription(verse + response?.transcription);
            }
          } else {
            asrDebug('checkTask task not in list', {
              taskId: current,
              activeTaskIds: activeTasks.map((t) => t.taskId),
            });
          }
        } else {
          asrDebug('checkTask no activeTasks', {
            taskId: current,
            chunkPreview: asrDebugPreview(verse + response?.transcription),
          });
          setTranscription(verse + response?.transcription);
        }
        setTaskId(
          nextTask,
          nextTask ? 'advance to next verse task' : 'all verse tasks complete'
        );
      } else if (response?.transcription === '') {
        asrDebug('checkTask empty transcription', { taskId: current });
        status(t.noAsrTranscription);
        setTaskId('', 'empty transcription from API');
      } else {
        console.log(`${current} not done`, response);
        asrDebug('checkTask pending', { taskId: current });
        setWorking(true);
      }
    } catch (errResult: unknown) {
      asrDebug('checkTask error', {
        taskId: current,
        message: axiosErrorMessage(errResult),
      });
      await showTaskFailure(axiosErrorMessage(errResult));
    } finally {
      checkingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setTranscription]);

  const launchTimer = () => {
    if (taskTimer.current) return;
    void checkTask();
    taskTimer.current = setInterval(() => {
      void checkTask();
    }, timerDelay);
  };

  const closing = (reason: string, detail?: Record<string, unknown>) => {
    asrDebug('closing dialog', {
      reason,
      taskId: taskIdRef.current,
      taskCount: tasksRef.current?.length,
      incompleteTasks: tasksRef.current
        ?.filter((t) => !t.complete)
        .map((t) => ({ taskId: t.taskId, verse: t.verse })),
      ...detail,
    });
    if (taskTimer.current) {
      clearInterval(taskTimer.current);
      taskTimer.current = undefined;
    }
    setTranscribing(false);
    setWorking(false);
    onClose && onClose();
  };

  const postTranscribe = async () => {
    const remId =
      remoteId('mediafile', mediaId, memory?.keyMap as RecordKeyMap) ?? mediaId;
    const asr = asrState ?? (getAsrSettings() as IAsrState | undefined);
    const iso = asr?.asrIso ?? 'eng';
    const romanize = asr?.selectRoman ?? false;
    const phoneticParam = phonetic ? '?phonetic=true' : '';
    const localMedia = findRecord(memory, 'mediafile', mediaId) as
      | MediaFileD
      | undefined;
    const localVerses = describeVerseRegions(localMedia);
    // Master posts `.../transcription/{iso}/{romanize}` (no method segment) and
    // the API creates one TRTask per Mark Verses region (`uuid|26`, …). The
    // develop path `.../{method}` (even `/mms`) currently returns a single
    // unversed TRTask when Verse regions exist — match master for multi-verse.
    const useMasterVerseTimedPath = localVerses.verseRegionCount > 1;
    const method = useMasterVerseTimedPath
      ? undefined
      : (asr?.method ?? 'mms');
    const remote = coordinator?.getSource?.('remote') as
      | { requestQueue?: { length?: number } }
      | undefined;
    const queueLenBefore = remote?.requestQueue?.length ?? -1;
    const postPath = useMasterVerseTimedPath
      ? `mediafiles/${remId}/transcription/${iso}/${romanize}${phoneticParam}`
      : `mediafiles/${remId}/transcription/${iso}/${romanize}/${method}${phoneticParam}`;
    asrDebug('postTranscribe start', {
      mediaId,
      remId,
      iso,
      romanize,
      configuredMethod: asr?.method ?? 'mms',
      method: method ?? '(omitted — master verse-timed path)',
      useMasterVerseTimedPath,
      postPath,
      phonetic,
      force,
      contentVerses: contentVersesRef.current,
      remoteQueueLength: queueLenBefore,
      ...localVerses,
    });
    try {
      // Mark Verses saves land in Orbit first; the transcription API reads
      // server-side mediafile.segments. Wait so Verse regions are pushed.
      await waitForRemoteQueue('asr before postTranscribe');
      const queueLenAfterWait = remote?.requestQueue?.length ?? -1;
      asrDebug('postTranscribe after remote queue wait', {
        remId,
        remoteQueueLength: queueLenAfterWait,
        ...describeVerseRegions(
          findRecord(memory, 'mediafile', mediaId) as MediaFileD | undefined
        ),
      });
      const response = (await axiosPost(postPath, undefined, token)) as {
        data: { data: MediaFileD };
      };
      const mediaRec = response?.data.data as MediaFileD;
      const newTasks = getTasks(mediaRec);
      asrDebug('postTranscribe response', {
        remId,
        taskCount: newTasks?.length ?? 0,
        tasksMissingVerse: newTasks?.filter((t) => !t.verse).length ?? 0,
        ...describeTrTaskRaw(mediaRec),
        ...describeVerseRegions(mediaRec),
        localVsApiMismatch:
          (describeVerseRegions(localMedia).verseRegionCount > 1 &&
            (newTasks?.length ?? 0) <= 1) ||
          false,
      });
      if (newTasks) {
        onPullTasks(remId);
        syncTasks(newTasks);
        setTaskId(newTasks[0]?.taskId ?? '', 'postTranscribe first task');
      } else {
        asrDebug('postTranscribe no tasks', { mediaId: remId });
        status(t.aiAsrFailed);
        closing('postTranscribe returned no TRTask regions');
      }
    } catch (errResult: unknown) {
      const error = errResult as AxiosError;
      const message = axiosErrorMessage(errResult);
      asrDebug('postTranscribe error', { mediaId: remId, message });
      const { summary, details } = aeroTaskErrorParts(message, t.aiAsrFailed);
      logError(
        Severity.error,
        errorReporter,
        infoMsg(error, summary + (details ? `: ${details}` : ''))
      );
      await clearTrTasks();
      status(
        <AeroTaskErrorMessage
          summary={summary || t.aiAsrFailed}
          details={details}
          detailsLabel={tm.details}
        />,
        AlertSeverity.Error,
        message
      );
      closing('postTranscribe failed', { message });
    }
  };

  React.useEffect(() => {
    if (taskId) {
      asrDebug('taskId effect: active', {
        taskId,
        hasTimer: Boolean(taskTimer.current),
      });
      if (!taskTimer.current) {
        launchTimer();
      } else {
        void checkTask();
      }
    } else if (taskTimer.current) {
      asrDebug('taskId effect: clearing timer (taskId empty)', {
        incompleteTasks: tasksRef.current
          ?.filter((t) => !t.complete)
          .map((t) => ({ taskId: t.taskId, verse: t.verse })),
      });
      clearInterval(taskTimer.current);
      taskTimer.current = undefined;
      closing('taskId became empty while timer was running');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  React.useEffect(() => {
    if (addingRef.current) return;
    setTranscribing(true);
    setWorking(false);
    const mediaRec = findRecord(memory, 'mediafile', mediaId) as MediaFileD;
    const [resumeTaskId, resumeTasks] = getTaskId(mediaRec);
    asrDebug('mount', {
      mediaId,
      force,
      contentVerses: contentVersesRef.current,
      resumeTaskId,
      resumeTaskCount: resumeTasks?.length,
      savedTranscriptionPreview: asrDebugPreview(
        mediaRec?.attributes?.transcription ?? ''
      ),
    });
    if (
      (!resumeTasks || !resumeTaskId) &&
      ignoreVs((mediaRec?.attributes?.transcription ?? '').trim())
    ) {
      asrDebug('mount: transcription exists, closing', { mediaId });
      status(t.transcriptionExists);
      closing('saved transcription already exists (ignoreVs)');
    } else if (resumeTaskId && !force) {
      asrDebug('mount: resume polling', {
        resumeTaskId,
        resumeTasks: resumeTasks?.map((t) => ({
          taskId: t.taskId,
          verse: t.verse,
          complete: t.complete,
        })),
      });
      if (resumeTasks) syncTasks(resumeTasks);
      setTaskId(resumeTaskId, 'resume incomplete TRTask');
    } else {
      asrDebug('mount: postTranscribe', { force, resumeTaskId });
      void postTranscribe();
    }

    return () => {
      asrDebug('unmount', {
        mediaId,
        taskId: taskIdRef.current,
        hadTimer: Boolean(taskTimer.current),
      });
      if (taskTimer.current) {
        clearInterval(taskTimer.current);
        taskTimer.current = undefined;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTaskVerse = tasks?.find((task) => task.taskId === taskId)?.verse;
  const progressMessage =
    passageSpan && currentTaskVerse
      ? formatAsrProgressMessage(t.asrProgress, passageSpan, currentTaskVerse)
      : t.aiWillContinue.replace(/\{0\}/g, tc.recognizeSpeech);

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
        <LinearProgress />
        {(working || Boolean(taskId)) && (
          <Typography
            sx={{
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              overflowWrap: 'break-word',
            }}
          >
            {progressMessage}
          </Typography>
        )}
        <ActionRow>
          <Button onClick={() => closing('user clicked Close')}>{ts.close}</Button>
        </ActionRow>
      </Stack>
    </Box>
  );
}
