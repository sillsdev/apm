import { useGlobal, useGetGlobal } from '../context/useGlobal';

import logError, { Severity } from './logErrorService';
import {
  axiosDelete,
  axiosGet,
  axiosPostFile,
  axiosSendSignedUrl,
} from './axios';
import { AxiosResponse, HttpStatusCode } from 'axios';
import { uploadFile } from '../store/upload/actions';
import { useContext, useRef } from 'react';
import { TokenContext } from '../context/TokenProvider';
import { loadBlobAsync } from './loadBlob';
import { MediaFileAttributes } from '../model/mediafile';
import { runWithUploadRetries } from '../store/upload/uploadRetry';

interface fileTask {
  taskId: string;
  cb: (file: File | Error) => void;
  cancelRef: React.RefObject<boolean>;
  emptyResultPolls?: number;
  pollStartedAt?: number;
  /** GET poll in flight — skip until it returns. */
  polling?: boolean;
  /** Poll returned a URL; hold off further ticks until loadBlobAsync finishes. */
  validating?: boolean;
}
const timerDelay = 10000; //10 seconds
/** S3 URL returned but body still empty — stop after this many poll ticks. */
const MAX_EMPTY_S3_RESULT_POLLS = 3;
const S3_POLL_MAX_WAIT_MS = 10 * 60 * 1000;

export enum AudioAiFunc {
  noiseRemoval = 'noiseremoval',
  voiceConversion = 'voiceconversion',
}
export interface IRequestAudio {
  func: AudioAiFunc;
  cancelRef: React.RefObject<boolean>;
  file: File;
  targetVoice?: string;
  cb: (file: File | Error) => void;
}

interface AudioAIResult {
  requestAudioAi: (p: IRequestAudio) => Promise<void>;
}

export const useAudioAi = (): AudioAIResult => {
  const [reporter] = useGlobal('errorReporter');
  const [errorReporter] = useGlobal('errorReporter');
  const returnAsS3List = useRef<fileTask[]>([]);
  const taskTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const token = useContext(TokenContext)?.state?.accessToken ?? null;
  const getGlobal = useGetGlobal();
  const cancelled = new Error('canceled');

  const cleanupTimer = (): void => {
    if (returnAsS3List.current.length === 0 && taskTimer.current) {
      try {
        clearInterval(taskTimer.current);
      } catch (error) {
        logError(Severity.error, errorReporter, error as Error);
      }
      taskTimer.current = undefined;
    }
  };

  const cleanupS3 = (job: fileTask): void => {
    const i = returnAsS3List.current.indexOf(job);
    if (i >= 0) returnAsS3List.current.splice(i, 1);
    cleanupTimer();
  };

  const failEmptyS3Result = (task: fileTask): never => {
    throw new Error('AI result file empty ' + task.taskId);
  };

  const noteEmptyS3Result = (task: fileTask): void => {
    task.emptyResultPolls = (task.emptyResultPolls ?? 0) + 1;
    if (task.emptyResultPolls >= MAX_EMPTY_S3_RESULT_POLLS)
      failEmptyS3Result(task);
  };

  const checkAsS3 = async (
    func: AudioAiFunc,
    task: fileTask
  ): Promise<File | undefined> => {
    if (task.polling || task.validating) return undefined;
    if (
      task.pollStartedAt &&
      new Date().getTime() - task.pollStartedAt > S3_POLL_MAX_WAIT_MS
    ) {
      throw new Error('AI result timed out');
    }
    task.polling = true;
    let result: unknown;
    try {
      result = await axiosGet(`aero/${func}/s3/${task.taskId}`);
    } finally {
      task.polling = false;
    }
    const response = result as unknown as { message: string };
    if (response?.message) {
      task.validating = true;
      try {
        const b = await loadBlobAsync(response?.message);
        if (!b?.size) {
          noteEmptyS3Result(task);
          return undefined;
        }
        cleanupS3(task);
        if (token) {
          const audioBase = response.message.split('?')[0] as string;
          const filename = audioBase.split('/').pop() as string;
          deleteS3File(filename);
        }
        return new File([b], task.taskId + '.wav');
      } finally {
        if (returnAsS3List.current.indexOf(task) >= 0) task.validating = false;
      }
    }
    return undefined;
  };

  const checkTasks = async (func: AudioAiFunc): Promise<void> => {
    returnAsS3List.current.forEach(async (filetask) => {
      if (filetask.polling || filetask.validating) return;
      try {
        if (!filetask.cancelRef.current) {
          const file = await checkAsS3(func, filetask);
          if (file) {
            filetask.cb(file);
          }
        } else {
          filetask.cb(cancelled);
          cleanupS3(filetask);
        }
      } catch (error: unknown) {
        logError(Severity.error, errorReporter, error as Error);
        filetask.cb(error as Error);
        cleanupS3(filetask);
      }
    });
  };

  const launchTimer = (func: AudioAiFunc): void => {
    taskTimer.current = setInterval(() => {
      checkTasks(func);
    }, timerDelay);
  };

  const deleteS3File = (filename: string): void => {
    if (token)
      axiosDelete(`S3Files/AI/${filename}`, token).catch((err) =>
        logError(Severity.error, errorReporter, err)
      );
  };

  const doCancel = (
    func: AudioAiFunc,
    cb: (file: File | Error) => void
  ): void => {
    checkTasks(func);
    cb(cancelled);
  };

  const s3request = async (
    func: AudioAiFunc,
    cancelRef: React.RefObject<boolean>,
    file: File,
    targetVoice: string | undefined,
    cb: (file: File | Error) => void
  ): Promise<void> => {
    if (getGlobal('offline') || !token) return;
    const result = await axiosGet(
      `S3Files/put/AI/${file.name}/wav`,
      undefined,
      token
    );
    const response = result as string;
    runWithUploadRetries(async () => {
      const status = await uploadFile(
        {
          id: 0,
          audioUrl: response,
          contentType: 'audio/wav',
        } as MediaFileAttributes & { id: number },
        file,
        reporter
      );
      if (status.statusNum !== 0) {
        throw new Error(status.statusText || 'upload failed');
      }
    })
      .then(() => {
        if (!cancelRef.current)
          axiosSendSignedUrl(`aero/${func}/fromfile`, file.name, targetVoice)
            .then((nrresponse) => {
              const response = nrresponse as AxiosResponse;
              if (response.status === HttpStatusCode.Ok) {
                const taskId = response.data ?? '';
                returnAsS3List.current.push({
                  taskId,
                  cb,
                  cancelRef,
                  emptyResultPolls: 0,
                  pollStartedAt: Date.now(),
                });
                if (!taskTimer.current) launchTimer(func);
              } else cb(new Error(response.statusText));
            })
            .catch((err) => {
              logError(Severity.error, errorReporter, err);
              cb(err as Error);
            });
        else deleteS3File(file.name);
      })
      .catch((err: unknown) => {
        const rej = err as { statusText?: string };
        const error = new Error(rej.statusText ?? 'upload failed');
        logError(Severity.error, errorReporter, error);
        cb(error);
      });
  };

  const requestAudioAi = async ({
    func,
    cancelRef,
    file,
    targetVoice,
    cb,
  }: IRequestAudio): Promise<void> => {
    if (getGlobal('offline')) return;
    const useS3 = true; // file.size > 6000000 || Boolean(targetVoice);  V2 doesn't work with data in request
    // larger sizes give Network Error
    if (useS3)
      s3request(func, cancelRef, file, targetVoice, cb).catch((err) =>
        cb(err as Error)
      );
    else
      axiosPostFile(`aero/${func}`, file)
        .then((nrresponse) => {
          const response = nrresponse as AxiosResponse;
          if (cancelRef.current) doCancel(func, cb);
          else if (response.status === HttpStatusCode.Ok) {
            const taskId = response.data ?? '';
            returnAsS3List.current.push({
              taskId,
              cb,
              cancelRef,
              emptyResultPolls: 0,
              pollStartedAt: Date.now(),
            });
            if (!taskTimer.current) launchTimer(func);
          } else if (response.status === HttpStatusCode.PayloadTooLarge) {
            s3request(func, cancelRef, file, targetVoice, cb).catch((err) =>
              cb(err as Error)
            );
          } else cb(new Error(response.statusText));
        })
        .catch((err) => {
          if (
            err.status === HttpStatusCode.PayloadTooLarge ||
            err.message.toString().includes('413')
          ) {
            const msg = `payload too large: ${file.size} ... retrying`;
            logError(Severity.info, errorReporter, msg);

            return s3request(func, cancelRef, file, targetVoice, cb).catch(
              (err) => cb(err as Error)
            );
          } else if (
            err.code === 'ERR_NETWORK' ||
            err.message === 'Network Error'
          ) {
            const msg = `network error (size: ${file.size}) ... retrying `;
            logError(Severity.info, errorReporter, msg);

            return s3request(func, cancelRef, file, targetVoice, cb).catch(
              (err) => cb(err as Error)
            );
          } else cb(err as Error);
        });
  };

  return { requestAudioAi };
};
