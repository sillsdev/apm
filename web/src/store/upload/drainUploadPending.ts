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
