import { getLocalMediaBlob } from './localMediaBlobStore';
import { logError, Severity } from './logErrorService';

type Reporter = Parameters<typeof logError>[1];

/**
 * Web: a mediafile is missing when this device has no Local Media Blob for it
 * (ADR 0017). Desktop continues to use dataPath.
 *
 * A failed IndexedDB read counts as missing, so the caller downloads from the
 * cloud again; it is logged as info because that fallback recovers.
 */
export const isLocalMediaMissing = async (
  mediafileId: string,
  reporter: Reporter
): Promise<boolean> => {
  if (!mediafileId) return true;
  try {
    const record = await getLocalMediaBlob(mediafileId);
    return !record?.blob;
  } catch (err) {
    logError(
      Severity.info,
      reporter,
      `Local Media Blob read failed for ${mediafileId}; treating as missing: ${String(err)}`
    );
    return true;
  }
};
