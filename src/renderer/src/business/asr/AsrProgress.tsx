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
  const [memory] = useGlobal('memory');
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

  const passageSpan: PassageVerseSpanInput | undefined = React.useMemo(
    () => passageVerseSpanFromPassage(passage),
    [passage]
  );

  React.useEffect(() => {
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
      return tsks;
    } else {
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

  const setTaskId = (nextTaskId: string) => {
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
    setTaskId('');
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
    if (!current || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const response: any = await axiosGet(`aero/transcription/${current}`);
      const pollError = transcriptionPollError(response);
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
            if (!alreadyHasContent) {
              setTranscription(verse + response?.transcription);
            }
          }
        } else {
          setTranscription(verse + response?.transcription);
        }
        setTaskId(nextTask);
      } else if (response?.transcription === '') {
        status(t.noAsrTranscription);
        setTaskId('');
      } else {
        console.log(`${current} not done`, response);
        setWorking(true);
      }
    } catch (errResult: unknown) {
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

  const closing = () => {
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
    const method = asr?.method ?? 'mms';
    const phoneticParam = phonetic ? '?phonetic=true' : '';
    try {
      const response = (await axiosPost(
        `mediafiles/${remId}/transcription/${iso}/${romanize}/${method}${phoneticParam}`,
        undefined,
        token
      )) as { data: { data: MediaFileD } };
      const mediaRec = response?.data.data as MediaFileD;
      const newTasks = getTasks(mediaRec);
      if (newTasks) {
        onPullTasks(remId);
        syncTasks(newTasks);
        setTaskId(newTasks[0]?.taskId ?? '');
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
      closing();
    }
  };

  React.useEffect(() => {
    if (taskId) {
      if (!taskTimer.current) {
        launchTimer();
      } else {
        void checkTask();
      }
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
    const [resumeTaskId, resumeTasks] = getTaskId(mediaRec);
    if (
      (!resumeTasks || !resumeTaskId) &&
      ignoreVs((mediaRec?.attributes?.transcription ?? '').trim())
    ) {
      status(t.transcriptionExists);
      closing();
    } else if (resumeTaskId && !force) {
      if (resumeTasks) syncTasks(resumeTasks);
      setTaskId(resumeTaskId);
    } else {
      void postTranscribe();
    }

    return () => {
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
          <Button onClick={closing}>{ts.close}</Button>
        </ActionRow>
      </Stack>
    </Box>
  );
}
