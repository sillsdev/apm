import type { PendingUploadRestore } from '../../../store/upload/pendingMediaUploads';

export interface KeyTermPendingRestoreArgs {
  term: string;
  termIndex: number;
  target: string;
  organizationId: string;
}

/**
 * Restore metadata for Term Verify Audio Translation pending uploads so
 * Home → Retry can recreate the orgkeytermtarget chip (TT-7721).
 *
 * Returns `undefined` when organization or term is missing.
 */
export const keyTermPendingRestore = ({
  term,
  termIndex,
  target,
  organizationId,
}: KeyTermPendingRestoreArgs): PendingUploadRestore | undefined =>
  organizationId && term
    ? {
        kind: 'orgkeytermtarget',
        term,
        termIndex,
        target,
        organizationId,
      }
    : undefined;
