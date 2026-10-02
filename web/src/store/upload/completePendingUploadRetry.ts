import Memory from '@orbit/memory';
import JSONAPISource from '@orbit/jsonapi';
import { IndexedDBSource } from '@orbit/indexeddb';
import { RecordKeyMap } from '@orbit/records';
import { pullTableList } from '../../crud/pullTableList';
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

  if (!restore) return;

  const localId =
    (memory?.keyMap
      ? remoteIdGuid('mediafile', stringId, memory.keyMap as RecordKeyMap)
      : undefined) ?? stringId;

  await restoreAfterPendingUpload({
    mediaId: localId,
    restore,
    memory,
    user,
  });
}
