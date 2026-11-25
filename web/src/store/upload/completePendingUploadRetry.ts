import Memory from '@orbit/memory';
import JSONAPISource from '@orbit/jsonapi';
import { IndexedDBSource } from '@orbit/indexeddb';
import { RecordKeyMap, RecordTransformBuilder } from '@orbit/records';
import { localCopyRemoval } from '../../crud/offlineIdCopy';
import { pullTableList } from '../../crud/pullTableList';
import { findRecord } from '../../crud/tryFindRecord';
import { remoteIdGuid } from '../../crud/remoteId';
import type { PendingUploadRestore } from './pendingMediaUploads';
import { restoreAfterPendingUpload } from './restoreAfterPendingUpload';

export interface CompletePendingUploadRetryArgs {
  stringId: string;
  restore?: PendingUploadRestore;
  memory: Memory;
  remote: JSONAPISource;
  backup: IndexedDBSource;
  reporter: unknown;
  user: string;
}

/**
 * After a successful pending-upload Retry: sync the mediafile into Orbit, then
 * recreate secondary links from persisted restore metadata (TT-7363).
 */
export async function completePendingUploadRetry({
  stringId,
  restore,
  memory,
  remote,
  backup,
  reporter,
  user,
}: CompletePendingUploadRetryArgs): Promise<void> {
  await pullTableList(
    'mediafile',
    [stringId],
    memory,
    remote,
    backup,
    reporter as never
  );

  const localId =
    (memory?.keyMap
      ? remoteIdGuid('mediafile', stringId, memory.keyMap as RecordKeyMap)
      : undefined) ?? stringId;

  await removeLocalCopy(memory, backup, localId);

  if (!restore) return;

  await restoreAfterPendingUpload({
    mediaId: localId,
    restore,
    memory,
    user,
  });
}

/**
 * A web take recorded offline has a local-only mediafile whose id is its
 * Upload Pending key, which the upload sent as `offlineId` (TT-7907). Remove
 * it as soon as the server row is pulled, so the take is not listed twice
 * until the data-changes pull (DeleteLocalCopy) would remove it.
 */
async function removeLocalCopy(
  memory: Memory,
  backup: IndexedDBSource,
  pulledId: string
): Promise<void> {
  const serverRecord = findRecord(memory, 'mediafile', pulledId);
  if (!serverRecord) return;
  const op = localCopyRemoval(
    memory,
    serverRecord,
    new RecordTransformBuilder()
  );
  if (!op) return;
  // sync, not update: the server never had the local copy, and an update
  // would discard its Upload Pending blob (see splitLocalOnlyOps).
  await backup.sync(() => [op]);
  await memory.sync(() => [op]);
}
