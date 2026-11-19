import {
  isUploadPendingInFlight,
  type UploadPendingEntry,
} from './uploadPendingBlobs';

/**
 * Uploads entries one at a time, oldest first, stopping at the first failure:
 * once one fails the network is likely down again, and the next `online`
 * event resumes the drain.
 */
export const drainUploadPending = async (
  entries: UploadPendingEntry[],
  upload: (entry: UploadPendingEntry) => Promise<boolean>
): Promise<void> => {
  for (const entry of entries) {
    if (isUploadPendingInFlight(entry.key)) continue;
    if (!(await upload(entry))) break;
  }
};

/**
 * Runs `drain` while holding this project's Web Lock, so two tabs never drain
 * the same project at once: upload claims live in each tab's memory, and two
 * drains would upload the same blob. Returns `busy` without draining when
 * another tab holds the lock, since its drain covers the same blobs. Runs
 * unlocked where Web Locks is missing (Safari before 15.4, jsdom).
 */
export const withProjectDrainLock = async <T>(
  projectId: string,
  drain: () => Promise<T>,
  busy: T
): Promise<T> => {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) {
    return drain();
  }
  return navigator.locks.request(
    `upload-pending-drain:${projectId}`,
    { ifAvailable: true },
    async (lock) => (lock ? drain() : busy)
  );
};
