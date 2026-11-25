import Axios, { AxiosError } from 'axios';
import { API_CONFIG, isElectron } from '../../../api-variable';
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
import { typeLimit } from '../../utils/typeLimit';
import { UploadType } from '../../components/UploadType';
import path from 'path-browserify';
import bugsnagClient from '../../auth/bugsnagClient';
import { Dispatch } from 'redux';
import { MediaFileAttributes } from '../../model';
import { MainAPI } from '../../model/main-api';
import {
  sleepMs,
  uploadPutTimeoutMs,
  uploadRetryDelayMs,
  UPLOAD_MAX_ATTEMPTS,
  waitForImportExportIdle,
  isRetryableUploadStatus,
} from './uploadRetry';
import {
  appendPendingMediaUpload,
  findPendingUploadIdForIdentity,
  PendingUploadIdentity,
  PendingUploadRecord,
  PendingUploadMediaRecord,
  PendingUploadRestore,
  removeMatchingPendingUploads,
  removePendingMediaUpload,
  updatePendingMediaUpload,
} from './pendingMediaUploads';
import {
  claimUploadPending,
  findUploadPendingKeyForIdentity,
  newUploadPendingKey,
  recordUploadPendingFailure,
  releaseUploadPending,
  saveUploadPendingBlob,
  settleUploadPending,
} from './uploadPendingBlobs';
import {
  isPutBlobBodyReject,
  putBlobBody,
  UPLOAD_FAILED_TEXT,
  type PutBlobBodyReject,
} from './putBlobBody';
import { requestUploadPendingBackgroundSync } from './uploadPendingBackgroundSync';
import { localMediaPath } from '../../utils/localMediaPath';

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
    await ipc?.write(writeName, bytes, {
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

export class UploadFileReject extends Error {
  statusNum: number;
  statusText: string;
  httpStatus?: number;

  constructor(statusNum: number, statusText: string, httpStatus?: number) {
    super(statusText);
    this.name = 'UploadFileReject';
    this.statusNum = statusNum;
    this.statusText = statusText;
    this.httpStatus = httpStatus;
  }
}

/** Turns a failed PUT into an UploadFileReject, reporting it the way the inline XHR did. */
const toUploadFileReject = (
  rej: PutBlobBodyReject,
  data: MediaFileAttributes,
  file: File,
  errorReporter: typeof bugsnagClient
): UploadFileReject => {
  if (rej.failure === 'http') {
    logError(
      Severity.error,
      errorReporter,
      `upload ${file.name}: (${rej.statusNum}) ${rej.statusText}`
    );
  } else if (rej.failure === 'network') {
    const host = (() => {
      try {
        return new URL(data.audioUrl).host;
      } catch {
        return 'unknown';
      }
    })();
    const statusText = [
      UPLOAD_FAILED_TEXT,
      rej.httpStatus ? `HTTP ${rej.httpStatus}` : 'network error',
      typeof navigator !== 'undefined' && !navigator.onLine
        ? 'offline'
        : undefined,
      `${file.name} (${file.size} bytes)`,
      host,
    ]
      .filter(Boolean)
      .join('; ');
    logError(
      Severity.error,
      errorReporter,
      `upload ${file.name}: ${statusText}`
    );
    return new UploadFileReject(rej.statusNum, statusText, rej.httpStatus);
  }
  // Aborts and timeouts are retried by the caller without a report.
  return new UploadFileReject(rej.statusNum, rej.statusText, rej.httpStatus);
};

export const uploadFile = async (
  data: MediaFileAttributes,
  file: File,
  errorReporter: typeof bugsnagClient
): Promise<{ statusNum: number; statusText: string }> => {
  try {
    return await putBlobBody({
      url: data.audioUrl,
      blob: file,
      contentType: data.contentType,
      timeoutMs: uploadPutTimeoutMs(file.size),
    });
  } catch (error: unknown) {
    // putBlobBody only rejects with PutBlobBodyReject; anything else is a bug.
    if (!isPutBlobBodyReject(error)) throw error;
    throw toUploadFileReject(error, data, file, errorReporter);
  }
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
  /**
   * Called once per file. On failure, errorMessage carries the raw error code
   * (unsupported type, too big, local write, or network) for the caller to
   * surface.
   */
  cb?: (
    n: number,
    success: boolean,
    data?: MediaFileAttributes,
    errorMessage?: string
  ) => void;
  onTerminalFailure?: (info: UploadTerminalFailureInfo) => void;
  /** When retrying from the pending queue, pass the entry id to remove after a successful upload. */
  pendingUploadIdToClearOnSuccess?: string;
  /**
   * Domain restore metadata persisted on the pending row so Retry can recreate
   * secondary Orbit links after re-upload (TT-7363).
   */
  pendingRestore?: PendingUploadRestore;
  /**
   * When set, online uploads wait until this is false before staging/POST so first-login
   * ImportTab sync (`importexportBusy`) can finish first.
   */
  getImportExportBusy?: () => boolean;
  /**
   * Project the media belongs to. On web it scopes the Upload Pending Local
   * Media Blob saved before the cloud attempt (ADR 0017 eviction / switch).
   */
  projectId?: string;
  // TODO cleanup: see if we can consolidate the props above, especially the error handling and end behavior ones
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
    pendingRestore,
    getImportExportBusy,
    projectId = '',
  }: NextUploadProps) =>
  (dispatch: Dispatch) => {
    dispatch({ payload: n, type: UPLOAD_ITEM_PENDING });
    // We don't put general resources into the retry queue. They are a multi-step job the user must do in one go
    const queueForRetry =
      uploadType !== UploadType.ProjectResource ||
      Boolean(pendingUploadIdToClearOnSuccess);
    // TT-7365: a retried Save (e.g. re-clicked after an offline failure) may
    // not carry pendingUploadIdToClearOnSuccess (that's only wired from the
    // Pending Media Uploads dialog's Retry button). Reuse any pending row
    // already staged for this section/artifact/file so repeated Save clicks
    // update one row instead of appending a new one each time
    // writeFileLocal stages the same recording under a new versioned path.
    // Desktop only: on web the Upload Pending queue is the Local Media Blob
    // store, and pendingUploadIdToClearOnSuccess is a blob key (ADR 0016).
    let pendingIdToClear =
      isElectron && queueForRetry
        ? (pendingUploadIdToClearOnSuccess ??
          findPendingUploadIdForIdentity(record as PendingUploadMediaRecord))
        : undefined;
    // Web: key of this recording's Upload Pending Local Media Blob, once saved.
    let uploadPendingKey: string | undefined;
    const sendError = (n: number, message: string, mediaid?: number): void => {
      dispatch({
        payload: {
          current: n,
          error: message,
          mediaid,
        },
        type: UPLOAD_ITEM_FAILED,
      });
      if (cb) cb(n, false, undefined, message);
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
    if (size > typeLimit(uploadType) * 1000000) {
      sendError(n, `${name}:toobig:${(size / 1000000).toFixed(2)}`);
      return;
    }
    if (offline) {
      if (!isDownloadable) {
        if (cb) cb(n, true, { ...record });
      } else {
        void (async () => {
          try {
            const w = await writeFileLocal(files[n] as File);
            if (cb) cb(n, true, { ...record, audioUrl: w.relativeMediaPath });
          } catch (err: unknown) {
            logError(
              Severity.error,
              errorReporter,
              infoMsg(err as Error, `local write failed: ${name}`)
            );
            sendError(n, `${name} failed local write`);
          }
        })();
      }
      return;
    }
    const pendingIdentity = (): PendingUploadIdentity => {
      const pendingRec = record as PendingUploadMediaRecord;
      return {
        planId: pendingRec.planId,
        passageId: pendingRec.passageId,
        artifactTypeId: pendingRec.artifactTypeId,
        originalFile: pendingRec.originalFile,
      };
    };

    const completeCB = async (
      success: boolean,
      data: MediaFileAttributes | undefined,
      statusNum: number | undefined,
      statusText: string
    ): Promise<void> => {
      if (success) {
        dispatch({ payload: n, type: UPLOAD_ITEM_SUCCEEDED });
        // Await secondary restore / afterUpload before dropping the pending
        // row so a restore failure leaves Retry available (TT-7363 / PR #565).
        try {
          if (cb) await Promise.resolve(cb(n, true, data));
        } catch {
          return;
        }
        if (isElectron) {
          if (pendingIdToClear) {
            removePendingMediaUpload(pendingIdToClear);
          }
          removeMatchingPendingUploads(pendingIdentity());
        } else if (uploadPendingKey) {
          try {
            await settleUploadPending({
              key: uploadPendingKey,
              mediafileId: (data as { stringId?: string } | undefined)
                ?.stringId,
              projectId,
              identity: pendingIdentity(),
            });
          } catch (err: unknown) {
            // The blob stays Upload Pending, so a later retry uploads it
            // again: a duplicate in the cloud, but no lost audio.
            logError(
              Severity.error,
              errorReporter,
              infoMsg(err as Error, `mark Cloud-backed failed: ${name}`)
            );
          }
        }
      } else {
        // statusNum is undefined when the request never reached the server,
        // so don't render a literal "(undefined)" at the user (TT-7583).
        const message = `upload ${name}: (${statusNum ?? 'no response'}) ${statusText}`;
        dispatch({
          payload: { current: n, error: message },
          type: UPLOAD_ITEM_FAILED,
        });
        if (cb) cb(n, false, data, message);
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
            languagebcp47: mediaA.languagebcp47,
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

    /**
     * Web: save the recording as an Upload Pending Local Media Blob before the
     * cloud attempt, so a failed or interrupted upload never loses it
     * (ADR 0016). Returns the claimed blob key, or undefined when the device
     * save failed; the upload still proceeds since the cloud may yet succeed.
     */
    const protectOnDevice = async (): Promise<string | undefined> => {
      let key: string | undefined;
      try {
        const existing =
          pendingUploadIdToClearOnSuccess ??
          (await findUploadPendingKeyForIdentity(projectId, pendingIdentity()));
        // When an upload of that blob is already running in this tab, this
        // attempt saves its own copy rather than racing on one row.
        key =
          existing && claimUploadPending(existing)
            ? existing
            : newUploadPendingKey();
        if (key !== existing) claimUploadPending(key);
        await saveUploadPendingBlob({
          key,
          projectId,
          file: files[n] as File,
          request: {
            uploadType,
            record: snapshotForPending(),
            ...(pendingRestore ? { restore: pendingRestore } : {}),
          },
        });
        if (!navigator.onLine) {
          // Offline: the browser wakes an open tab to drain once connectivity
          // returns. Online, registering would fire at once and start a
          // second drain beside this upload. Never rejects (catches inside).
          void requestUploadPendingBackgroundSync();
        }
        return key;
      } catch (err: unknown) {
        if (key) releaseUploadPending(key);
        logError(
          Severity.error,
          errorReporter,
          infoMsg(err as Error, `save on this device failed: ${name}`)
        );
        return undefined;
      }
    };

    // Every failure inside reports through sendError / completeCB, so the
    // promise is not awaited by the thunk's caller.
    void (async () => {
      try {
        await uploadWithLocalCopy();
      } finally {
        if (uploadPendingKey) releaseUploadPending(uploadPendingKey);
      }
    })();

    async function uploadWithLocalCopy(): Promise<void> {
      if (getImportExportBusy) {
        await waitForImportExportIdle(getImportExportBusy);
      }

      if (!isElectron && !skipUpload && isDownloadable) {
        uploadPendingKey = await protectOnDevice();
      }

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

      const queueOnDesktop = (
        patch: Omit<PendingUploadRecord, 'id' | 'failedAt'>
      ): PendingUploadRecord =>
        pendingIdToClear
          ? (updatePendingMediaUpload(pendingIdToClear, patch) ??
            appendPendingMediaUpload(patch))
          : appendPendingMediaUpload(patch);

      if (localAbsolutePath && queueForRetry) {
        const pendingRecord = queueOnDesktop({
          localAbsolutePath,
          fileSize: size,
          uploadType,
          record: snapshotForPending(),
          ...(pendingRestore ? { restore: pendingRestore } : {}),
        });
        pendingIdToClear = pendingRecord.id;
      }

      /**
       * Web: the blob stays Upload Pending for the online retry. The returned
       * record only feeds the failure message; no localStorage row is kept.
       */
      const webTerminalFailure = async (
        patch: Omit<PendingUploadRecord, 'id' | 'failedAt'>
      ): Promise<PendingUploadRecord> => {
        if (uploadPendingKey) {
          try {
            await recordUploadPendingFailure(uploadPendingKey);
          } catch (err: unknown) {
            // Only the retry count is lost; the blob is still Upload Pending.
            logError(
              Severity.error,
              errorReporter,
              infoMsg(err as Error, `count upload retry failed: ${name}`)
            );
          }
        }
        return {
          ...patch,
          id: uploadPendingKey ?? '',
          failedAt: new Date().toISOString(),
        };
      };

      const finalizeTerminalFailure = async (
        remoteId: number | undefined,
        postSucceeded: boolean,
        statusNum: number | undefined,
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
        if (queueForRetry) {
          const pathForQueue =
            localAbsolutePath ||
            ((files[n] as File & { path?: string }).path ?? '');
          const queuePatch = {
            localAbsolutePath: pathForQueue,
            fileSize: size,
            uploadType,
            record: snapshotForPending(),
            ...(pendingRestore ? { restore: pendingRestore } : {}),
          };
          const pendingRecord = isElectron
            ? queueOnDesktop(queuePatch)
            : await webTerminalFailure(queuePatch);
          onTerminalFailure?.({
            localAbsolutePath: pathForQueue || pendingRecord.localAbsolutePath,
            originalFileName: name,
            pendingRecord,
            cloudRowDeleted,
            failedRemoteMediaId,
          });
        }
        // Web: the server was never reached and the take is safe as an Upload
        // Pending blob, so hand its key back. useMediaUpload creates a
        // local-only mediafile from it (localOnlyMedia), letting later steps
        // use the take offline.
        const savedOnDevice =
          !isElectron &&
          uploadPendingKey &&
          statusNum === undefined &&
          cloudRowDeleted
            ? {
                ...(record as MediaFileAttributes),
                audioUrl: localMediaPath(uploadPendingKey),
                uploadPendingKey,
              }
            : undefined;
        await completeCB(false, savedOnDevice, statusNum, statusText);
      };

      // The Upload Pending key is the offline id (TT-7907): the server answers
      // a retried POST whose first response was lost with the row it already
      // made, and a take's local-only record gives way to that row.
      const postBody: MediaUpload = uploadPendingKey
        ? {
            data: {
              ...vndRecord.data,
              attributes: {
                ...vndRecord.data.attributes,
                'offline-id': uploadPendingKey,
              },
            },
          }
        : vndRecord;
      let json: unknown;
      for (let attempt = 0; attempt < UPLOAD_MAX_ATTEMPTS; attempt++) {
        try {
          const response = await Axios.post(
            API_CONFIG.host + '/api/mediafiles',
            postBody,
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
          if (!isRetryableUploadStatus(st)) {
            await finalizeTerminalFailure(
              undefined,
              false,
              st!,
              `Upload ${name} failed: ${ax.message}`
            );
            return;
          }
          // Offline the retries can't succeed; the Upload Pending drain sends
          // it when connectivity returns, so don't keep the user waiting.
          if (attempt < UPLOAD_MAX_ATTEMPTS - 1 && navigator.onLine !== false) {
            await sleepMs(uploadRetryDelayMs(attempt));
            continue;
          }
          // we get here after the 5 tries. Undefined status means we never reached the
          // server
          await finalizeTerminalFailure(
            undefined,
            false,
            st,
            st
              ? `Upload ${name} failed.`
              : `Upload ${name} failed: network error`
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
        await completeCB(true, mediaA, 0, '');
        return;
      }

      let lastNum = 0;
      let lastTxt = '';
      for (let attempt = 0; attempt < UPLOAD_MAX_ATTEMPTS; attempt++) {
        try {
          const status = await uploadFile(mediaA, fileForPut, errorReporter);
          if (status.statusNum === 0) {
            await completeCB(true, mediaA, 0, '');
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
    }
  };
export const uploadComplete = (): UploadMsgs => {
  return { type: UPLOAD_COMPLETE };
};
