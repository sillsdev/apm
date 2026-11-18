import { logError, Severity } from './logErrorService';

type Reporter = Parameters<typeof logError>[1];

/**
 * Web offline prep: whether the browser reports room for `bytes` more.
 * Answers true when the browser can't tell (no `navigator.storage.estimate`,
 * or it fails), so a missing API never blocks a download; IndexedDB write
 * failures are still reported per file.
 */
export const hasStorageRoomFor = async (
  bytes: number,
  reporter: Reporter
): Promise<boolean> => {
  if (bytes <= 0) return true;
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate)
    return true;
  try {
    const { quota, usage } = await navigator.storage.estimate();
    if (quota === undefined || usage === undefined) return true;
    return quota - usage >= bytes;
  } catch (err) {
    logError(
      Severity.info,
      reporter,
      `Storage estimate failed; downloading anyway: ${String(err)}`
    );
    return true;
  }
};
