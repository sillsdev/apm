import Axios, { AxiosError } from 'axios';
import { API_CONFIG } from '../../../api-variable';
import {
  UPLOAD_LIST,
  UPLOAD_ITEM_PENDING,
  UPLOAD_ITEM_CREATED,
  UPLOAD_ITEM_SUCCEEDED,
  UPLOAD_ITEM_FAILED,
  UPLOAD_COMPLETE,
  UploadMsgs,
  MediaUpload,
} from './types';
import {
  dataPath,
  infoMsg,
  logError,
  PathType,
  Severity,
  createPathFolder,
  removeExtension,
} from '../../utils';
import { DateTime } from 'luxon';
import _ from 'lodash';
import { SIZELIMIT } from '../../components/MediaUpload';
import { UploadType } from '../../components/UploadType';
import path from 'path-browserify';
import bugsnagClient from '../../auth/bugsnagClient';
import { Dispatch } from 'redux';
import { MediaFileAttributes } from '../../model';
import { MainAPI } from '../../model/main-api';
import {
  sleepMs,
  uploadRetryDelayMs,
  UPLOAD_MAX_ATTEMPTS,
} from './uploadRetry';
import {
  appendPendingMediaUpload,
  PendingUploadRecord,
  PendingUploadMediaRecord,
  removePendingMediaUpload,
} from './pendingMediaUploads';

const ipc = window?.api as MainAPI;

export interface WriteFileLocalResult {
  relativeMediaPath: string;
  absolutePath: string;
}

export const uploadFiles = (files: File[]) => (dispatch: Dispatch) => {
  dispatch({
    payload: files,
    type: UPLOAD_LIST,
  });
};
const nextVersion = (fileName: string): string => {
  const { name, ext } = removeExtension(fileName);
  const { name: origName, ext: version } = removeExtension(name);
  if (version && version.length > 3 && version.startsWith('ver')) {
    const ver = Number(version.substring(3)) + 1;
    return `${origName}.ver${ver.toString().padStart(2, '0')}.${ext}`;
  }
  return `${name}.ver02.${ext}`;
};

let writeName = ''; // used for message if copy fails

export const writeFileLocal = async (
  file: File,
  remoteName?: string
): Promise<WriteFileLocalResult> => {
  const local = { localname: '' };
  const filePath = (file as any)?.path || '';
  await dataPath(
    remoteName ? remoteName : `http://${filePath}`,
    PathType.MEDIA,
    local
  );
  writeName = local.localname;
  if (!remoteName && filePath === '') writeName += path.sep + file.name;
  await createPathFolder(writeName);
  while (await ipc?.exists(writeName)) {
    writeName = nextVersion(writeName);
  }
  if (filePath) {
    await ipc?.copyFile(filePath, writeName);
  } else {
    // Modern replacement for deprecated readAsBinaryString
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    ipc?.write(writeName, bytes, {
      encoding: 'binary',
      flag: 'wx', // write - fail if file exists
    });
  }
  const outName = writeName.split(path.sep).pop() || writeName;
  return {
    relativeMediaPath: path.join(PathType.MEDIA, outName),
    absolutePath: writeName,
  };
};
const isNotDownloadable = (content: string): boolean => /^text/.test(content); //Links also start with text/

export const deleteMediaAfterFailedUploadWithRetries = async (
  id: number,
  token: string,
  errorReporter: typeof bugsnagClient
): Promise<boolean> => {
  for (let attempt = 0; attempt < UPLOAD_MAX_ATTEMPTS; attempt++) {
    try {
      await Axios.delete(API_CONFIG.host + '/api/mediafiles/' + id, {
        headers: {
          Authorization: 'Bearer ' + token,
        },
      });
      return true;
    } catch (err) {
      logError(
        Severity.error,
        errorReporter,
        infoMsg(err as Error, `delete mediafile ${id} attempt ${attempt + 1}`)
      );
      if (attempt < UPLOAD_MAX_ATTEMPTS - 1) {
        await sleepMs(uploadRetryDelayMs(attempt));
      }
    }
  }
  return false;
};

export type UploadFileReject = {
  statusNum: number;
  statusText: string;
  httpStatus?: number;
};

export const uploadFile = (
  data: MediaFileAttributes,
  file: File,
  errorReporter: typeof bugsnagClient
): Promise<{ statusNum: number; statusText: string }> => {
  return new Promise((resolve, reject) => {
    let xhr = new XMLHttpRequest();
    const cleanup = (): void => {
      xhr.onload = null;
      xhr.onerror = null;
      xhr.onabort = null;
      // @ts-ignore allow memory to be released
      xhr = null;
    };
    xhr.open('PUT', data.audioUrl, true);
    xhr.setRequestHeader('Content-Type', data.contentType);

    xhr.onload = () => {
      if (xhr.status < 300) {
        cleanup();
        resolve({ statusNum: 0, statusText: '' });
      } else {
        logError(
          Severity.error,
          errorReporter,
          `upload ${file.name}: (${xhr.status}) ${xhr.responseText}`
        );
        const rej: UploadFileReject = {
          statusNum: xhr.status,
          statusText: xhr.responseText || 'upload failed',
          httpStatus: xhr.status,
        };
        // cleanup removes the xhr values loaded into UploadFileReject (above)
        cleanup();
        reject(rej);
      }
    };
    xhr.onerror = () => {
      cleanup();
      const rej: UploadFileReject = {
        statusNum: 500,
        statusText: 'upload failed',
        httpStatus: undefined,
      };
      reject(rej);
    };
    xhr.onabort = () => {
      cleanup();
      const rej: UploadFileReject = {
        statusNum: 499,
        statusText: 'upload aborted',
        httpStatus: 499,
      };
      reject(rej);
    };
    xhr.send(file.slice());
  });
};

export interface UploadTerminalFailureInfo {
  localAbsolutePath: string;
  originalFileName: string;
  pendingRecord: PendingUploadRecord;
  cloudRowDeleted: boolean;
  /** Set when POST succeeded but DELETE of the cloud row failed after PUT exhaustion. */
  failedRemoteMediaId?: number;
}

export interface NextUploadProps {
  record: MediaFileAttributes;
  files: File[];
  n: number;
  token: string;
  offline: boolean;
  errorReporter: typeof bugsnagClient;
  uploadType: UploadType;
  cb?: (n: number, success: boolean, data?: MediaFileAttributes) => void;
  onTerminalFailure?: (info: UploadTerminalFailureInfo) => void;
  /** When retrying from the pending queue, pass the entry id to remove after a successful upload. */
  pendingUploadIdToClearOnSuccess?: string;
}
export const nextUpload =
  ({
    record,
    files,
    n,
    token,
    offline,
    errorReporter,
    uploadType,
    cb,
    onTerminalFailure,
    pendingUploadIdToClearOnSuccess,
  }: NextUploadProps) =>
  (dispatch: Dispatch) => {
    dispatch({ payload: n, type: UPLOAD_ITEM_PENDING });
    const sendError = (n: number, message: string, mediaid?: number): void => {
      dispatch({
        payload: {
          current: n,
          error: message,
          mediaid,
        },
        type: UPLOAD_ITEM_FAILED,
      });
      if (cb) cb(n, false);
    };
    const { name, size, type } = files[n] as File;
    const isDownloadable = !isNotDownloadable(type);

    const acceptExtPat =
      /\.wav$|\.mp3$|\.m4a$|\.ogg$|\.webm$|\.pdf$|\.png$|\.jpg$/i;
    if (
      isDownloadable &&
      !acceptExtPat.test(record.originalFile.split('?')[0] || '')
    ) {
      sendError(n, `${name}:unsupported`);
      return;
    }
    if (size > SIZELIMIT(uploadType) * 1000000) {
      sendError(n, `${name}:toobig:${(size / 1000000).toFixed(2)}`);
      return;
    }
    if (offline) {
      if (!isDownloadable) {
        if (cb) cb(n, true, { ...record });
      } else
        try {
          writeFileLocal(files[n] as File).then((w) => {
            if (cb) cb(n, true, { ...record, audioUrl: w.relativeMediaPath });
          });
        } catch (err: unknown) {
          logError(
            Severity.error,
            errorReporter,
            infoMsg(err as Error, `failed getting name: ${name}`)
          );
          sendError(n, `${name} failed local write`);
        }
      return;
    }
    const completeCB = (
      success: boolean,
      data: MediaFileAttributes | undefined,
      statusNum: number,
      statusText: string
    ): void => {
      if (success) {
        dispatch({ payload: n, type: UPLOAD_ITEM_SUCCEEDED });
        if (pendingUploadIdToClearOnSuccess) {
          removePendingMediaUpload(pendingUploadIdToClearOnSuccess);
        }
        if (cb) cb(n, true, data);
      } else {
        dispatch({
          payload: {
            current: n,
            error: `upload ${name}: (${statusNum}) ${statusText}`,
          },
          type: UPLOAD_ITEM_FAILED,
        });
        if (cb) cb(n, false, data);
      }
    };

    const toVnd = (record: unknown): MediaUpload => {
      const mediaA = record as MediaFileAttributes;
      const mediaRel = record as { [string: string]: string };
      const vnd: MediaUpload = {
        data: {
          type: 'mediafiles',
          attributes: {
            'version-number': mediaA.versionNumber,
            'original-file': mediaA.originalFile,
            'content-type': mediaA.contentType,
            'eaf-url': mediaA.eafUrl,
            // Using ISO 8601 UTC timestamp via luxon
            'date-created': DateTime.utc().toISO(),
            'source-segments': mediaA.sourceSegments,
            'performed-by': mediaA.performedBy,
            topic: mediaA.topic,
            transcription: mediaA.transcription,
          },
          relationships: {
            'last-modified-by-user': {
              data: {
                type: 'users',
                id: mediaRel.userId?.toString() || null,
              },
            },
          },
        },
      };
      if (mediaRel.passageId)
        vnd.data.relationships.passage = {
          data: { type: 'passages', id: mediaRel.passageId.toString() },
        };
      if (mediaRel.planId)
        vnd.data.relationships.plan = {
          data: { type: 'plans', id: mediaRel.planId.toString() },
        };
      if (mediaRel.artifactTypeId)
        vnd.data.relationships['artifact-type'] = {
          data: {
            type: 'artifacttypes',
            id: mediaRel.artifactTypeId.toString(),
          },
        };
      if (mediaRel.sourceMediaId)
        vnd.data.relationships['source-media'] = {
          data: { type: 'mediafiles', id: mediaRel.sourceMediaId.toString() },
        };
      if (mediaRel.recordedbyUserId)
        vnd.data.relationships['recordedby-user'] = {
          data: { type: 'users', id: mediaRel.recordedbyUserId.toString() },
        };
      return vnd;
    };
    const fromVnd = (data: MediaUpload): unknown => {
      const json = _.mapKeys(data.data.attributes, (v, k) => _.camelCase(k));
      json.id = data.data.id as number;
      json.stringId = json.id.toString();
      return json;
    };

    const vndRecord = toVnd(record);
    const ct = record.contentType as string;
    const skipUpload = isNotDownloadable(ct) || ct.includes('s3link');

    const snapshotForPending = (): PendingUploadMediaRecord => {
      const r = record as MediaFileAttributes & Record<string, string>;
      return JSON.parse(JSON.stringify(r)) as PendingUploadMediaRecord;
    };

    const stageFileForOnlineUpload = async (
      file: File
    ): Promise<{ absolutePath: string; fileForUpload: File }> => {
      const fromDisk = (file as File & { path?: string }).path;
      if (fromDisk && ipc && (await ipc.exists(fromDisk))) {
        return { absolutePath: fromDisk, fileForUpload: file };
      }
      if (!ipc?.read || !ipc?.write) {
        return { absolutePath: fromDisk || '', fileForUpload: file };
      }
      const w = await writeFileLocal(file);
      const buf = await ipc.read(w.absolutePath);
      if (!(buf instanceof Uint8Array)) {
        throw new Error('Could not read staged media file');
      }
      const bytes = Uint8Array.from(buf);
      return {
        absolutePath: w.absolutePath,
        fileForUpload: new File([bytes], file.name, { type: file.type }),
      };
    };

    void (async () => {
      let localAbsolutePath = '';
      let fileForPut = files[n] as File;

      if (!skipUpload && isDownloadable) {
        try {
          const staged = await stageFileForOnlineUpload(files[n] as File);
          localAbsolutePath = staged.absolutePath;
          fileForPut = staged.fileForUpload;
        } catch (err: unknown) {
          logError(
            Severity.error,
            errorReporter,
            infoMsg(err as Error, `local staging failed: ${name}`)
          );
          sendError(n, `${name}: local save failed`);
          return;
        }
      }

      const finalizeTerminalFailure = async (
        remoteId: number | undefined,
        postSucceeded: boolean,
        statusNum: number,
        statusText: string
      ): Promise<void> => {
        let cloudRowDeleted = !postSucceeded || remoteId === undefined;
        let failedRemoteMediaId: number | undefined;
        if (
          postSucceeded &&
          remoteId !== undefined &&
          !Number.isNaN(remoteId)
        ) {
          cloudRowDeleted = await deleteMediaAfterFailedUploadWithRetries(
            remoteId,
            token,
            errorReporter
          );
          if (!cloudRowDeleted) failedRemoteMediaId = remoteId;
        }
        const pathForQueue =
          localAbsolutePath ||
          ((files[n] as File & { path?: string }).path ?? '');
        const pendingRecord = appendPendingMediaUpload({
          localAbsolutePath: pathForQueue,
          fileSize: size,
          uploadType,
          record: snapshotForPending(),
        });
        onTerminalFailure?.({
          localAbsolutePath: pathForQueue || pendingRecord.localAbsolutePath,
          originalFileName: name,
          pendingRecord,
          cloudRowDeleted,
          failedRemoteMediaId,
        });
        completeCB(false, undefined, statusNum, statusText);
      };

      let json: unknown;
      for (let attempt = 0; attempt < UPLOAD_MAX_ATTEMPTS; attempt++) {
        try {
          const response = await Axios.post(
            API_CONFIG.host + '/api/mediafiles',
            vndRecord,
            {
              headers: {
                'Content-Type': 'application/vnd.api+json',
                Authorization: 'Bearer ' + token,
              },
            }
          );
          dispatch({ payload: n, type: UPLOAD_ITEM_CREATED });
          json = fromVnd(response.data);
          break;
        } catch (err) {
          const ax = err as AxiosError;
          const st = ax.response?.status;
          if (st === 401 || st === 403) {
            await finalizeTerminalFailure(
              undefined,
              false,
              st,
              `Upload ${name} failed.`
            );
            return;
          }
          if (attempt < UPLOAD_MAX_ATTEMPTS - 1) {
            await sleepMs(uploadRetryDelayMs(attempt));
            continue;
          }
          await finalizeTerminalFailure(
            undefined,
            false,
            st ?? 500,
            `Upload ${name} failed.`
          );
          return;
        }
      }

      if (!json) {
        await finalizeTerminalFailure(
          undefined,
          false,
          500,
          `Upload ${name} failed.`
        );
        return;
      }

      const mediaA = json as MediaFileAttributes;
      const mediaId = (json as { id?: number }).id;

      if (skipUpload) {
        completeCB(true, mediaA, 0, '');
        return;
      }

      let lastNum = 0;
      let lastTxt = '';
      for (let attempt = 0; attempt < UPLOAD_MAX_ATTEMPTS; attempt++) {
        try {
          const status = await uploadFile(mediaA, fileForPut, errorReporter);
          if (status.statusNum === 0) {
            completeCB(true, mediaA, 0, '');
            return;
          }
          lastNum = status.statusNum;
          lastTxt = status.statusText;
        } catch (err: unknown) {
          const rej = err as UploadFileReject;
          lastNum = rej.statusNum ?? 500;
          lastTxt = rej.statusText ?? 'upload failed';
          logError(
            Severity.error,
            errorReporter,
            infoMsg(
              err instanceof Error ? err : new Error(String(err)),
              `Upload ${name} failed.`
            )
          );
        }
        if (attempt < UPLOAD_MAX_ATTEMPTS - 1) {
          await sleepMs(uploadRetryDelayMs(attempt));
        }
      }
      await finalizeTerminalFailure(mediaId, true, lastNum, lastTxt);
    })();
  };
export const uploadComplete = (): UploadMsgs => {
  return { type: UPLOAD_COMPLETE };
};
