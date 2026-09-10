/**
 * Ensures Pending Uploads dialog busy / queue continuation always runs after
 * secondary Orbit restore, even when restore rejects (TT-7363 / PR #565).
 */
export async function withPendingRetryBusyRelease<T>(
  work: () => Promise<T>,
  releaseBusy: () => void
): Promise<T> {
  try {
    return await work();
  } finally {
    releaseBusy();
  }
}
