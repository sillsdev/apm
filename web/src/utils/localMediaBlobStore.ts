/**
 * Local Media Blob store (web). Durable audio bytes kept in IndexedDB for
 * local-first playback, offline work, and Upload Pending recordings.
 *
 * Kept in its own database, separate from the Orbit `transcriber` database, so
 * Orbit schema migrations never touch media bytes and media eviction never
 * touches records. See ADR 0016 (blobs retained after cloud confirm) and
 * ADR 0017 (web project-switch / eviction rules).
 *
 * Writes resolve only after the transaction's `complete` event: a `put()`
 * request succeeding does not mean the data is committed.
 *
 * Durability rule: any write that creates or ends the Upload Pending state
 * uses `durability: 'strict'` (flushed to disk before `complete`). Saving an
 * Upload Pending blob needs it because the device copy may be the only copy
 * of a recording; marking Cloud-backed needs it because a rolled-back flip
 * would leave the row Upload Pending and get it uploaded twice. Writes that
 * only touch Cloud-backed copies (downloads, access time) or bookkeeping
 * (retry count) use the cheaper `relaxed` commit: losing them on power loss
 * costs a re-download or a miscount, never audio.
 */

import bugsnagClient from '../auth/bugsnagClient';
import { logError, Severity } from './logErrorService';

export const LOCAL_MEDIA_DB_NAME = 'localMedia';
const DB_VERSION = 1;
const STORE = 'blobs';
const BY_STATUS = 'status';
const BY_PROJECT = 'projectId';
const BY_PROJECT_STATUS = 'projectId_status';
const BY_CLIENT_TEMP_ID = 'clientTempId';

export type LocalMediaStatus = 'uploadPending' | 'cloudBacked';

const STATUSES: readonly LocalMediaStatus[] = ['uploadPending', 'cloudBacked'];

export interface LocalMediaBlobRecord {
  /** Primary key: mediafile id once known, else clientTempId. */
  key: string;
  /** Kept after re-key so callers holding the temp id still find the blob. */
  clientTempId?: string;
  mediafileId?: string;
  /** Scopes eviction to one project (ADR 0017). */
  projectId: string;
  status: LocalMediaStatus;
  blob: Blob;
  contentType: string;
  size: number;
  createdAt: number;
  retryCount: number;
  lastAccessedAt?: number;
  /**
   * What the upload path needs to send this blob to the cloud (record
   * snapshot, upload type, restore links). Opaque here: the store keeps it
   * across re-puts and the owner (`store/upload/uploadPendingBlobs.ts`)
   * validates it when read back.
   */
  uploadRequest?: unknown;
}

export type PutLocalMediaBlobInput = Pick<
  LocalMediaBlobRecord,
  'projectId' | 'status' | 'blob'
> &
  Partial<
    Pick<
      LocalMediaBlobRecord,
      | 'clientTempId'
      | 'mediafileId'
      | 'contentType'
      | 'createdAt'
      | 'uploadRequest'
    >
  >;

const isLocalMediaStatus = (value: unknown): value is LocalMediaStatus =>
  // Safe: STATUSES is the closed LocalMediaStatus union; includes narrows membership.
  STATUSES.includes(value as LocalMediaStatus);

const isOptionalString = (value: unknown) =>
  value === undefined || typeof value === 'string';

/** Validates a row read from IndexedDB before code trusts its shape. */
export const isLocalMediaBlobRecord = (
  value: unknown
): value is LocalMediaBlobRecord => {
  if (typeof value !== 'object' || value === null) return false;
  // Safe: null-checked object; field types are validated on the lines below.
  const r = value as Record<string, unknown>;
  return (
    typeof r.key === 'string' &&
    r.key.length > 0 &&
    typeof r.projectId === 'string' &&
    isLocalMediaStatus(r.status) &&
    r.blob instanceof Blob &&
    typeof r.contentType === 'string' &&
    typeof r.size === 'number' &&
    typeof r.createdAt === 'number' &&
    typeof r.retryCount === 'number' &&
    isOptionalString(r.clientTempId) &&
    isOptionalString(r.mediafileId) &&
    (r.lastAccessedAt === undefined || typeof r.lastAccessedAt === 'number')
  );
};

/**
 * Returns a stored row when it is well formed. A malformed row is reported
 * rather than dropped silently: it may be the only copy of an Upload Pending
 * recording, so its loss from the lists must be visible. Missing rows
 * (`undefined`) are a normal not-found and are not reported.
 */
const checkedRow = (value: unknown): LocalMediaBlobRecord | undefined => {
  if (value === undefined || isLocalMediaBlobRecord(value)) return value;
  const key =
    typeof value === 'object' && value !== null && 'key' in value
      ? String(value.key)
      : 'unknown';
  logError(
    Severity.error,
    bugsnagClient,
    `${LOCAL_MEDIA_DB_NAME}: ignored malformed Local Media Blob row (key ${key})`
  );
  return undefined;
};

const toRecords = (rows: unknown[]): LocalMediaBlobRecord[] =>
  rows
    .map(checkedRow)
    .filter((row): row is LocalMediaBlobRecord => row !== undefined);

/** Strict when the write creates or ends Upload Pending (ADR 0016). */
const durabilityFor = (
  nextStatus: LocalMediaStatus,
  previousStatus?: LocalMediaStatus
): IDBTransactionDurability =>
  nextStatus === 'uploadPending' || previousStatus === 'uploadPending'
    ? 'strict'
    : 'relaxed';

let dbPromise: Promise<IDBDatabase> | undefined;

const openDb = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(LOCAL_MEDIA_DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, {
          keyPath: 'key',
        });
        store.createIndex(BY_STATUS, 'status');
        store.createIndex(BY_PROJECT, 'projectId');
        store.createIndex(BY_PROJECT_STATUS, ['projectId', 'status']);
        store.createIndex(BY_CLIENT_TEMP_ID, 'clientTempId');
      };
      request.onsuccess = () => {
        const db = request.result;
        // Another tab upgrading the schema needs this connection closed.
        db.onversionchange = () => {
          db.close();
          dbPromise = undefined;
        };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        reject(new Error(`${LOCAL_MEDIA_DB_NAME} open blocked`));
    });
    // A failed open must not poison every later call.
    dbPromise.catch(() => {
      dbPromise = undefined;
    });
  }
  return dbPromise;
};

/** Closes the cached connection (tests, and before deleting the database). */
export const closeLocalMediaDb = async (): Promise<void> => {
  const pending = dbPromise;
  dbPromise = undefined;
  if (!pending) return;
  try {
    (await pending).close();
  } catch {
    // Open already failed; there is no connection to close.
  }
};

const requestResult = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/**
 * Runs `work` in one transaction and resolves with its value only after the
 * transaction commits (`complete`), so callers never treat an uncommitted
 * write as saved.
 */
const inTransaction = async <T>(
  mode: IDBTransactionMode,
  durability: IDBTransactionDurability,
  work: (store: IDBObjectStore) => Promise<T>
): Promise<T> => {
  const db = await openDb();
  const tx = db.transaction(STORE, mode, { durability });
  const committed = new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('transaction aborted'));
  });
  let result: T;
  try {
    result = await work(tx.objectStore(STORE));
  } catch (err) {
    // Abort throws if the transaction already finished; either way the
    // original error is the one to report.
    try {
      tx.abort();
    } catch {
      /* already finished */
    }
    // The abort rejection of `committed` is expected; `err` is the cause.
    committed.catch(() => undefined);
    throw err;
  }
  await committed;
  return result;
};

const findInStore = async (
  store: IDBObjectStore,
  id: string
): Promise<LocalMediaBlobRecord | undefined> => {
  const byKey = checkedRow(await requestResult(store.get(id)));
  if (byKey) return byKey;
  return checkedRow(
    await requestResult(store.index(BY_CLIENT_TEMP_ID).get(id))
  );
};

/**
 * Writes `next`, first removing `existing` when the key changed (a blob saved
 * under its clientTempId moving to its mediafile id). Runs inside the caller's
 * transaction, so the delete and put commit or roll back together.
 */
const replaceRecord = async (
  store: IDBObjectStore,
  existing: LocalMediaBlobRecord | undefined,
  next: LocalMediaBlobRecord
): Promise<void> => {
  if (existing && existing.key !== next.key)
    await requestResult(store.delete(existing.key));
  await requestResult(store.put(next));
};

/**
 * Once the cloud has assigned a mediafile id it is the blob's permanent
 * identity: a later write may confirm it but never change or clear it.
 * Returns the id to keep, or throws when `incoming` contradicts `known`.
 */
export const settledMediafileId = (
  known: string | undefined,
  incoming: string | undefined
): string | undefined => {
  if (known && incoming && known !== incoming)
    throw new Error(
      `Local Media Blob already has mediafile id ${known}; refusing ${incoming}`
    );
  return known || incoming || undefined;
};

/**
 * Stores a Local Media Blob. Resolves after commit with the saved record.
 * Key is the mediafile id when known (given now, or already on the stored
 * row), else `clientTempId`; one of the two ids is required. Re-putting an
 * existing blob replaces it but keeps its `createdAt`, retry count, and
 * mediafile id.
 */
export const putLocalMediaBlob = async (
  input: PutLocalMediaBlobInput
): Promise<LocalMediaBlobRecord> => {
  if (!input.mediafileId && !input.clientTempId)
    throw new Error('putLocalMediaBlob needs mediafileId or clientTempId');
  // Peek so ending Upload Pending (status → cloudBacked) still gets strict.
  const peek = await inTransaction('readonly', 'default', async (store) => {
    const byMedia = input.mediafileId
      ? await findInStore(store, input.mediafileId)
      : undefined;
    if (byMedia) return byMedia;
    return input.clientTempId
      ? findInStore(store, input.clientTempId)
      : undefined;
  });
  return inTransaction(
    'readwrite',
    durabilityFor(input.status, peek?.status),
    async (store) => {
      // The row may be under either id: still under its clientTempId when
      // the mediafile id arrives with this put, or already re-keyed when this
      // put carries only the clientTempId.
      const existing =
        (input.mediafileId
          ? await findInStore(store, input.mediafileId)
          : undefined) ??
        (input.clientTempId
          ? await findInStore(store, input.clientTempId)
          : undefined);
      const mediafileId = settledMediafileId(
        existing?.mediafileId,
        input.mediafileId
      );
      const key = mediafileId || input.clientTempId;
      // Unreachable after the guard above; narrows `key` for the compiler.
      if (!key) throw new Error('putLocalMediaBlob lost its key');
      const record: LocalMediaBlobRecord = {
        key,
        clientTempId: input.clientTempId ?? existing?.clientTempId,
        mediafileId,
        projectId: input.projectId,
        status: input.status,
        blob: input.blob,
        contentType: input.contentType ?? input.blob.type,
        size: input.blob.size,
        createdAt: existing?.createdAt ?? input.createdAt ?? Date.now(),
        retryCount: existing?.retryCount ?? 0,
        lastAccessedAt: existing?.lastAccessedAt,
        uploadRequest: input.uploadRequest ?? existing?.uploadRequest,
      };
      await replaceRecord(store, existing, record);
      return record;
    }
  );
};

/** Finds a blob by mediafile id or by the clientTempId it was saved under. */
export const getLocalMediaBlob = async (
  id: string
): Promise<LocalMediaBlobRecord | undefined> =>
  inTransaction('readonly', 'default', (store) => findInStore(store, id));

export const listLocalMediaBlobsByStatus = async (
  status: LocalMediaStatus
): Promise<LocalMediaBlobRecord[]> =>
  inTransaction('readonly', 'default', async (store) =>
    toRecords(await requestResult(store.index(BY_STATUS).getAll(status)))
  );

export const listLocalMediaBlobsByProject = async (
  projectId: string,
  status?: LocalMediaStatus
): Promise<LocalMediaBlobRecord[]> =>
  inTransaction('readonly', 'default', async (store) =>
    toRecords(
      await requestResult(
        status
          ? store.index(BY_PROJECT_STATUS).getAll([projectId, status])
          : store.index(BY_PROJECT).getAll(projectId)
      )
    )
  );

const updateRecord = async (
  id: string,
  durability: IDBTransactionDurability,
  change: (record: LocalMediaBlobRecord) => LocalMediaBlobRecord
): Promise<LocalMediaBlobRecord | undefined> =>
  inTransaction('readwrite', durability, async (store) => {
    const existing = await findInStore(store, id);
    if (!existing) return undefined;
    const next = change(existing);
    await replaceRecord(store, existing, next);
    return next;
  });

/**
 * Cloud confirmed the Audio File: mark Cloud-backed and keep the bytes
 * (ADR 0016). Passing `mediafileId` re-keys a blob saved under its
 * clientTempId; it rejects if the blob already has a different mediafile id.
 * Resolves undefined when no blob matches `id`.
 */
export const markLocalMediaBlobCloudBacked = async (
  id: string,
  mediafileId?: string
): Promise<LocalMediaBlobRecord | undefined> =>
  // Strict although the result is Cloud-backed: this write ends Upload
  // Pending, and losing it would cause a duplicate upload (see header).
  updateRecord(id, 'strict', (record) => {
    const settled = settledMediafileId(record.mediafileId, mediafileId);
    return {
      ...record,
      key: settled || record.key,
      mediafileId: settled,
      status: 'cloudBacked',
    };
  });

/** Counts a failed upload attempt; the blob stays Upload Pending. */
export const incrementLocalMediaBlobRetry = async (
  id: string
): Promise<LocalMediaBlobRecord | undefined> =>
  updateRecord(id, 'relaxed', (record) => ({
    ...record,
    retryCount: record.retryCount + 1,
  }));

/** Records playback/use so later eviction can prefer least-recently-used. */
export const touchLocalMediaBlob = async (
  id: string,
  now: number = Date.now()
): Promise<LocalMediaBlobRecord | undefined> =>
  updateRecord(id, 'relaxed', (record) => ({ ...record, lastAccessedAt: now }));

/**
 * Removes a blob. Only for hard-delete, guided-phrase eviction, free-space /
 * project-switch eviction, or a user-confirmed discard (ADR 0016/0017) — never
 * as the normal step after a successful upload.
 */
export const deleteLocalMediaBlob = async (id: string): Promise<boolean> =>
  // Strict for every delete: only discarding an Upload Pending blob strictly
  // needs it, but a user-confirmed discard must not reappear after power loss
  // and deletes are rare enough that the flush cost doesn't matter.
  inTransaction('readwrite', 'strict', async (store) => {
    const existing = await findInStore(store, id);
    if (!existing) return false;
    await requestResult(store.delete(existing.key));
    return true;
  });
