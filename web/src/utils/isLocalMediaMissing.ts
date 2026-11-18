import { getLocalMediaBlob } from './localMediaBlobStore';

/**
 * Web offline-prep inventory: a mediafile is missing when this device has no
 * Local Media Blob for it (ADR 0017). Desktop continues to use dataPath.
 */
export const isLocalMediaMissing = async (
  mediafileId: string
): Promise<boolean> => {
  if (!mediafileId) return true;
  try {
    const record = await getLocalMediaBlob(mediafileId);
    return !record?.blob;
  } catch {
    return true;
  }
};
