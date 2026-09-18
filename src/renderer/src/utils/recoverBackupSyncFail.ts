import IndexedDBSource from '@orbit/indexeddb';

const DB_NOT_OPEN = 'IndexedDB database is not yet open';

export const isIndexedDbNotOpen = (ex: unknown): boolean =>
  ex instanceof Error
    ? ex.message.includes(DB_NOT_OPEN)
    : typeof ex === 'string' && ex.includes(DB_NOT_OPEN);

/** Unstick blocking memory→backup sync when IndexedDB closed under us. */
export async function recoverBackupSyncFail(
  backup: IndexedDBSource | undefined,
  error: unknown
): Promise<void> {
  if (!isIndexedDbNotOpen(error)) {
    throw error;
  }
  const queue = backup?.syncQueue;
  if (!queue || queue.empty) return;

  try {
    if (typeof backup?.cache?.openDB === 'function' && !backup.cache.isDBOpen) {
      await backup.cache.openDB();
    }
    if (backup?.cache?.isDBOpen) {
      await queue.retry();
      return;
    }
  } catch {
    // still closed or retry failed — skip so loading is not stuck
  }
  await queue.skip().catch(() => {});
}
