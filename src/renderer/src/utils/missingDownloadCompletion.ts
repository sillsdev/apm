/**
 * TT-6932: helpers for offline missing-file download completion.
 * Dialog must stay open while any files remain missing after a download pass.
 */

/** True when fetchUrl/tryDownload yielded a usable local media path. */
export function isSuccessfulMediaFetch(
  path: string | undefined | null,
  expiredToken: string
): boolean {
  if (!path || path === expiredToken) return false;
  if (/^https?:\/\//i.test(path)) return false;
  return true;
}

/** Close the missing-files dialog only when the re-scan finds nothing left. */
export function shouldCloseMissingFilesDialog(
  remainingMissingCount: number
): boolean {
  return remainingMissingCount === 0;
}
