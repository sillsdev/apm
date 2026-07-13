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
import { ActionRow, AltButton } from '../../control';
import {
  ICardsStrings,
  ISharedStrings,
  IMainStrings,
  ITranscriberStrings,
  MediaFileD,
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
  const token = React.useContext(TokenContext)?.state?.accessToken ?? '';
  const { showMessage } = useSnackBar();
  const [taskId, setTaskIdx] = React.useState('');
  const taskIdRef = React.useRef('');
  const [tasks, setTasks] = React.useState<VerseTask[]>();
  const taskTimer = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const checkingRef = React.useRef(false);
  const timerDelay = 5000; //5 seconds
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const tc: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const tm: IMainStrings = useSelector(mainSelector, shallowEqual);
  const [errorReporter] = useGlobal('errorReporter');

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
          complete: contentVerses?.includes(part[1] ?? 'no-verses') ?? false,
        });
      });
      return tsks;
    } else {
      return undefined;
    }
  };

  const getTaskId = (
    mediaRec: MediaFileD | undefined
  ): [string | undefined, VerseTask[] | undefined] => {
    const tsks = getTasks(mediaRec);
    if (tsks && !tasks) setTasks(tsks);
    return [tsks?.find((tasks) => !tasks.complete)?.taskId, tsks];
  };

  const setTaskId = (taskId: string) => {
    setTaskIdx(taskId);
    taskIdRef.current = taskId;
    if (taskId === '') setTasks(undefined);
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

  const checkTask = async () => {
    const current = taskIdRef.current;
    if (!current || checkingRef.current) return;
    checkingRef.current = true;
    try {
      const response: any = await axiosGet(`aero/transcription/${current}`);
      const pollError = transcriptionPollError(response);
      if (pollError) {
        showTaskFailure(pollError);
        return;
      }
      if (response?.transcription) {
        let verse = '';
        let nextTask = '';
        if (tasks) {
          const ix = tasks.findIndex((t) => t.taskId === current);
          if (ix >= 0) {
            if (typeof tasks[ix]?.verse === 'string')
              verse = ` \\v ${tasks[ix].verse} `;
            if (tasks[ix]?.complete) tasks[ix].complete = true;
            nextTask =
              ix < tasks.length - 1 ? (tasks[ix + 1]?.taskId ?? '') : '';
          }
        }
        setTranscription(verse + response?.transcription);
        setTaskId(nextTask);
      } else if (response?.transcription === '') {
        status(t.noAsrTranscription);
        setTaskId('');
      } else {
        console.log(`${current} not done`, response);
        setWorking(true);
      }
    } catch (errResult: unknown) {
      showTaskFailure(axiosErrorMessage(errResult));
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
      const tasks = getTasks(mediaRec);
      if (tasks) {
        onPullTasks(remId);
        if (tasks.length > 1) setTasks(tasks);
        setTaskId(tasks[0]?.taskId ?? '');
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
    const [taskId, tasks] = getTaskId(mediaRec);
    if (
      (!tasks || !taskId) &&
      ignoreVs((mediaRec?.attributes?.transcription ?? '').trim())
    ) {
      status(t.transcriptionExists);
      closing();
    } else if (taskId && !force) {
      setTaskId(taskId);
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
            {t.aiWillContinue.replace(/\{0\}/g, tc.recognizeSpeech)}
          </Typography>
        )}
        <ActionRow>
          <AltButton onClick={closing}>{ts.close}</AltButton>
        </ActionRow>
      </Stack>
    </Box>
  );
}
