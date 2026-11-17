/**
 * Web Upload Pending queue. On web the Local Media Blob store is the source
 * of truth for Upload Pending (ADR 0016): each new recording is saved there
 * before the cloud attempt, stays `uploadPending` until the cloud confirms
 * it, and is then marked Cloud-backed and kept. Desktop keeps its own queue in
 * `pendingMediaUploads.ts` (localStorage rows pointing at media-folder files).
 */

import bugsnagClient from '../../auth/bugsnagClient';
import { UploadType } from '../../components/UploadType';
import {
  deleteLocalMediaBlob,
  incrementLocalMediaBlobRetry,
  listLocalMediaBlobsByProject,
  markLocalMediaBlobCloudBacked,
  putLocalMediaBlob,
  type LocalMediaBlobRecord,
} from '../../utils/localMediaBlobStore';
import { logError, Severity } from '../../utils/logErrorService';
import {
  pendingUploadIdentityKey,
  pendingUploadPassageKey,
  randomId,
  type PendingUploadIdentity,
  type PendingUploadMediaRecord,
  type PendingUploadRestore,
} from './pendingMediaUploads';

/** What a web Upload Pending blob needs to be sent to the cloud again. */
export interface UploadPendingRequest {
  uploadType: UploadType;
  record: PendingUploadMediaRecord;
  restore?: PendingUploadRestore;
}

export interface UploadPendingEntry {
  /** Local Media Blob key; the clientTempId while Upload Pending. */
  key: string;
  projectId: string;
  file: File;
  retryCount: number;
  request: UploadPendingRequest;
}

const UPLOAD_TYPES = new Set<unknown>(Object.values(UploadType));

/** Validates `uploadRequest` read back from IndexedDB before it is trusted. */
export const isUploadPendingRequest = (
  value: unknown
): value is UploadPendingRequest => {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!UPLOAD_TYPES.has(v.uploadType)) return false;
  if (typeof v.record !== 'object' || v.record === null) return false;
  const record = v.record as Record<string, unknown>;
  if (
    typeof record.planId !== 'string' ||
    typeof record.originalFile !== 'string' ||
    typeof record.contentType !== 'string'
  )
    return false;
  if (v.restore === undefined) return true;
  return (
    typeof v.restore === 'object' &&
    v.restore !== null &&
    typeof (v.restore as Record<string, unknown>).kind === 'string'
  );
};

const toEntry = (row: LocalMediaBlobRecord): UploadPendingEntry | undefined => {
  if (!isUploadPendingRequest(row.uploadRequest)) {
    // Kept in the store (it may be the only copy of the audio) but it cannot
    // be retried automatically, so make its existence visible.
    logError(
      Severity.error,
      bugsnagClient,
      `uploadPending blob ${row.key} has no valid upload request; not retried`
    );
    return undefined;
  }
  const { record } = row.uploadRequest;
  return {
    key: row.key,
    projectId: row.projectId,
    file: new File([row.blob], record.originalFile, {
      type: row.contentType || record.contentType,
    }),
    retryCount: row.retryCount,
    request: row.uploadRequest,
  };
};

/** Upload Pending entries for one project, oldest first. */
export const listUploadPendingEntries = async (
  projectId: string
): Promise<UploadPendingEntry[]> =>
  (await listLocalMediaBlobsByProject(projectId, 'uploadPending'))
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(toEntry)
    .filter((e): e is UploadPendingEntry => e !== undefined);

/**
 * Key of an Upload Pending blob already saved for this recording identity, so
 * a retried Save replaces it instead of adding a second copy (TT-7365).
 * Requires a passage, for the reason given on `findPendingUploadIdForIdentity`.
 */
export const findUploadPendingKeyForIdentity = async (
  projectId: string,
  identity: PendingUploadIdentity
): Promise<string | undefined> => {
  if (!identity.passageId) return undefined;
  const key = pendingUploadIdentityKey(identity);
  return (await listUploadPendingEntries(projectId)).find(
    (e) => pendingUploadIdentityKey(e.request.record) === key
  )?.key;
};

/** True when this passage has an Upload Pending recording (TT-7366 warn). */
export const hasUploadPendingForPassage = async (
  projectId: string,
  query: { planId: string; passageId: string; artifactTypeId?: string | null }
): Promise<boolean> => {
  if (!query.passageId) return false;
  const key = pendingUploadPassageKey(query);
  return (await listUploadPendingEntries(projectId)).some(
    (e) => pendingUploadPassageKey(e.request.record) === key
  );
};

/**
 * Drops Upload Pending blobs for this passage (replace-pending / clear
 * recording). Skips keys uploading in this tab. Optional `filter` matches
 * desktop `clearPendingUploads` (e.g. autosave-only).
 */
export const clearUploadPendingForPassage = async (
  projectId: string,
  query: { planId: string; passageId: string; artifactTypeId?: string | null },
  filter?: (record: PendingUploadMediaRecord) => boolean
): Promise<void> => {
  if (!query.passageId) return;
  const key = pendingUploadPassageKey(query);
  const toClear = (await listUploadPendingEntries(projectId)).filter(
    (e) =>
      pendingUploadPassageKey(e.request.record) === key &&
      !isUploadPendingInFlight(e.key) &&
      (!filter || filter(e.request.record))
  );
  for (const e of toClear) await deleteLocalMediaBlob(e.key);
};

export const newUploadPendingKey = (): string => randomId();

/**
 * Saves the recording as an Upload Pending Local Media Blob. Resolves only
 * after a strict commit, so the caller may then attempt the cloud upload
 * knowing the device copy survives a crash or reload.
 */
export const saveUploadPendingBlob = async (args: {
  key: string;
  projectId: string;
  file: File;
  request: UploadPendingRequest;
}): Promise<void> => {
  const { key, projectId, file, request } = args;
  await putLocalMediaBlob({
    clientTempId: key,
    projectId,
    status: 'uploadPending',
    blob: file,
    contentType: file.type || request.record.contentType,
    uploadRequest: request,
  });
};

/** A cloud attempt failed; the blob stays Upload Pending for a later retry. */
export const recordUploadPendingFailure = async (
  key: string
): Promise<void> => {
  await incrementLocalMediaBlobRetry(key);
};

/**
 * Cloud confirmed the upload: mark the blob Cloud-backed under its mediafile
 * id and keep the bytes (ADR 0016). Other Upload Pending blobs for the same
 * passage-scoped recording identity were earlier attempts of this upload and
 * are removed, as `removeMatchingPendingUploads` does on desktop; leaving them
 * would upload the same audio again. Unlike desktop, removing them deletes
 * audio, so without a passage (where unrelated resources can share an
 * identity, PR #603 review) they are left alone.
 */
export const settleUploadPending = async (args: {
  key: string;
  mediafileId: string | undefined;
  projectId: string;
  identity: PendingUploadIdentity;
}): Promise<void> => {
  const { key, mediafileId, projectId, identity } = args;
  await markLocalMediaBlobCloudBacked(key, mediafileId);
  if (!identity.passageId) return;
  const identityKey = pendingUploadIdentityKey(identity);
  const superseded = (await listUploadPendingEntries(projectId)).filter(
    (e) =>
      e.key !== key &&
      !isUploadPendingInFlight(e.key) &&
      pendingUploadIdentityKey(e.request.record) === identityKey
  );
  for (const e of superseded) await deleteLocalMediaBlob(e.key);
};

/**
 * Keys whose upload is running in this tab. The online-retry drain skips
 * them so a recording is never sent twice at once.
 */
const inFlight = new Set<string>();

/** Returns false when the key is already being uploaded. */
export const claimUploadPending = (key: string): boolean => {
  if (inFlight.has(key)) return false;
  inFlight.add(key);
  return true;
};

export const releaseUploadPending = (key: string): void => {
  inFlight.delete(key);
};

export const isUploadPendingInFlight = (key: string): boolean =>
  inFlight.has(key);
