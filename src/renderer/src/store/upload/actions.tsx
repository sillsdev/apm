import Axios from 'axios';
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
import bugsnagClient from 'auth/bugsnagClient';
import { Dispatch } from 'redux';
import { MediaFileAttributes } from 'model';
const ipc = window?.electron;

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
): Promise<string> => {
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
  return path.join(PathType.MEDIA, outName);
};
const isNotDownloadable = (content: string): boolean => /^text/.test(content); //Links also start with text/

const deleteMediaAfterFailedUpload = (
  id: number,
  token: string,
  errorReporter: typeof bugsnagClient
): void => {
  Axios.delete(API_CONFIG.host + '/api/mediafiles/' + id, {
    headers: {
      Authorization: 'Bearer ' + token,
    },
  }).catch((err) => {
    logError(
      Severity.error,
      errorReporter,
      infoMsg(err, `unable to remove orphaned mediafile ${id}`)
    );
  });
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
    xhr.send(file.slice());
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
        cleanup();
        reject({ statusNum: 500, statusText: 'upload failed' });
      }
    };
    xhr.onerror = () => {
      cleanup();
      reject({ statusNum: 500, statusText: 'upload failed' });
    };
    xhr.onabort = () => {
      cleanup();
      reject({ statusNum: 500, statusText: 'upload aborted' });
    };
  });
};

export interface NextUploadProps {
  record: MediaFileAttributes;
  files: File[];
  n: number;
  token: string;
  offline: boolean;
  errorReporter: typeof bugsnagClient;
  uploadType: UploadType;
  cb?: (n: number, success: boolean, data?: MediaFileAttributes) => void;
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
          writeFileLocal(files[n] as File).then((filename: string) => {
            if (cb) cb(n, true, { ...record, audioUrl: filename });
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

    const postIt = async (): Promise<unknown> => {
      let iTries = 5;
      while (iTries > 0) {
        try {
          //we have to use an axios call here because orbit is asynchronous
          //(even if you await)
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
          return fromVnd(response.data);
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          iTries--;
        }
      }
      sendError(n, `Upload ${name} failed.`);
      return undefined;
    };
    const vndRecord = toVnd(record);
    const ct = record.contentType as string;
    const skipUpload = isNotDownloadable(ct) || ct.includes('s3link');

    postIt().then(async (json: unknown) => {
      if (json) {
        const mediaA = json as MediaFileAttributes;
        const mediaId = (json as { [string: string]: number }).id;
        if (skipUpload) {
          if (completeCB) completeCB(true, mediaA, 0, '');
          return;
        }
        let statusNum = 0;
        let statusText = '';
        for (let iTries = 5; iTries; iTries--) {
          try {
            const status = await uploadFile(
              mediaA,
              files[n] as File,
              errorReporter
            );
            if (status.statusNum === 0) {
              completeCB(true, mediaA, status.statusNum, status.statusText);
              return;
            }
            statusNum = status.statusNum;
            statusText = status.statusText;
          } catch (err) {
            logError(
              Severity.error,
              errorReporter,
              infoMsg(err as Error, `Upload ${name} failed.`)
            );
            statusNum = 500;
            statusText = (err as Error).message;
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } finally {
            if (iTries === 1) {
              if (mediaId !== undefined)
                deleteMediaAfterFailedUpload(mediaId, token, errorReporter);
              completeCB(false, undefined, statusNum, statusText);
            }
          }
        }
      }
    });
  };
export const uploadComplete = (): UploadMsgs => {
  return { type: UPLOAD_COMPLETE };
};
