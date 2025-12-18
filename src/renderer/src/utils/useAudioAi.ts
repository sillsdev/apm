import { useGlobal, useGetGlobal } from '../context/useGlobal';

import logError, { Severity } from './logErrorService';
import {
  axiosDelete,
  axiosGet,
  axiosGetStream,
  axiosPostFile,
  axiosSendSignedUrl,
} from './axios';
import { AxiosResponse, HttpStatusCode } from 'axios';
import { uploadFile } from '../store/upload/actions';
import { useContext, useRef } from 'react';
import { TokenContext } from '../context/TokenProvider';
import { loadBlobAsync } from './loadBlob';
import { MediaFileAttributes } from '../model/mediafile';

interface fileTask {
  taskId: string;
  cb: (file: File | Error) => void;
  cancelRef: React.MutableRefObject<boolean>;
}
const timerDelay = 10000; //10 seconds

export enum AudioAiFunc {
  noiseRemoval = 'noiseremoval',
  voiceConversion = 'voiceconversion',
}
export interface IRequestAudio {
  func: AudioAiFunc;
  cancelRef: React.MutableRefObject<boolean>;
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
  const fileList: fileTask[] = [];
  const returnAsS3List: fileTask[] = [];
  const taskTimer = useRef<NodeJS.Timeout | undefined>(undefined);
  const token = useContext(TokenContext)?.state?.accessToken ?? null;
  const getGlobal = useGetGlobal();
  const cancelled = new Error('canceled');

  const cleanupTimer = (): void => {
    if (
      fileList.length === 0 &&
      returnAsS3List.length === 0 &&
      taskTimer.current
    ) {
      try {
        clearInterval(taskTimer.current);
      } catch (error) {
        logError(Severity.error, errorReporter, error as Error);
      }
      taskTimer.current = undefined;
    }
  };

  const cleanupFile = (job: fileTask): void => {
    fileList.splice(fileList.indexOf(job), 1);
    cleanupTimer();
  };

  const cleanupS3 = (job: fileTask): void => {
    returnAsS3List.splice(returnAsS3List.indexOf(job), 1);
    cleanupTimer();
  };

  const base64ToFile = (
    base64Data: string,
    fileName: string
  ): File | undefined => {
    try {
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);

      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'audio/wav' });
      // Create a File object from the Blob
      const file = new File([blob], fileName, { type: blob.type });
      return file;
    } catch (error: unknown) {
      console.log(error);
    }
  };

  const checkFile = async (
    func: AudioAiFunc,
    task: fileTask
  ): Promise<File | undefined> => {
    const response = await axiosGetStream(`aero/${func}/${task.taskId}`);
    const data = await response?.json();
    if (data) {
      cleanupFile(task);
      return base64ToFile(data.data, data.fileName ?? task.taskId);
    }
    return undefined;
  };

  const checkAsS3 = async (
    func: AudioAiFunc,
    task: fileTask
  ): Promise<File | undefined> => {
    const result = await axiosGet(`aero/${func}/s3/${task.taskId}`);
    const response = result as unknown as { message: string };
    if (response?.message) {
      cleanupS3(task); //prevent from doing this again before we're done here
      const b = await loadBlobAsync(response?.message);
      if (token) {
        const audioBase = response.message.split('?')[0] as string;
        const filename = audioBase.split('/').pop() as string;
        deleteS3File(filename);
      }
      if (b) return new File([b], task.taskId + '.wav');
      else throw new Error('bloberror');
    }
    return undefined;
  };

  const checkTasks = async (func: AudioAiFunc): Promise<void> => {
    fileList.forEach(async (filetask) => {
      try {
        if (!filetask.cancelRef.current) {
          const file = await checkFile(func, filetask);
          if (file) {
            filetask.cb(file);
          }
        } else {
          filetask.cb(cancelled);
          cleanupFile(filetask);
        }
      } catch (error: unknown) {
        logError(Severity.error, errorReporter, error as Error);
        console.log(error);
        filetask.cb(error as Error);
        cleanupFile(filetask);
      }
    });
    returnAsS3List.forEach(async (filetask) => {
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
        console.log(error);
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
    cancelRef: React.MutableRefObject<boolean>,
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
    uploadFile(
      {
        id: 0,
        audioUrl: response,
        contentType: 'audio/wav',
      } as MediaFileAttributes & { id: number },
      file,
      reporter
    ).then((status) => {
      if (status.statusNum === 0)
        if (!cancelRef.current)
          if (!cancelRef.current)
            axiosSendSignedUrl(`aero/${func}/fromfile`, file.name, targetVoice)
              .then((nrresponse) => {
                const response = nrresponse as AxiosResponse;
                if (response.status === HttpStatusCode.Ok) {
                  const taskId = response.data ?? '';
                  returnAsS3List.push({
                    taskId,
                    cb,
                    cancelRef,
                  });
                  if (!taskTimer.current) launchTimer(func);
                } else cb(new Error(response.statusText));
              })
              .catch((err) => {
                logError(Severity.error, errorReporter, err);
                cb(err as Error);
              })
              .finally(() => console.log('done', file.name));
          //deleteS3File(file.name));
          else doCancel(func, cb);
        else deleteS3File(file.name);
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
    // larger sizes give Network Error
    if (file.size > 6000000 || targetVoice)
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
            fileList.push({
              taskId,
              cb,
              cancelRef,
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
