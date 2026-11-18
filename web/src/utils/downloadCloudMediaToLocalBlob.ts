import { loadBlobAsync } from './loadBlob';
import { getLocalMediaBlob, putLocalMediaBlob } from './localMediaBlobStore';
import { localMediaPath } from './localMediaPath';

export { localMediaPath, isLocalMediaPath } from './localMediaPath';

export interface DownloadCloudMediaToLocalBlobProps {
  mediafileId: string;
  projectId: string;
  audioUrl: string;
  cancelled?: () => boolean;
}

export interface DownloadCloudMediaToLocalBlobResult {
  ok: boolean;
  path: string;
}

/**
 * Persist cloud media bytes as a Cloud-backed Local Media Blob.
 * Skips the network when this device already has the blob.
 */
export const downloadCloudMediaToLocalBlob = async (
  props: DownloadCloudMediaToLocalBlobProps
): Promise<DownloadCloudMediaToLocalBlobResult> => {
  const { mediafileId, projectId, audioUrl, cancelled } = props;
  if (!mediafileId || !projectId || !audioUrl) {
    return { ok: false, path: audioUrl || '' };
  }
  if (cancelled?.()) return { ok: false, path: audioUrl };

  const existing = await getLocalMediaBlob(mediafileId);
  if (existing?.blob) {
    return { ok: true, path: localMediaPath(mediafileId) };
  }

  if (cancelled?.()) return { ok: false, path: audioUrl };

  let blob: Blob | undefined;
  try {
    blob = await loadBlobAsync(audioUrl);
  } catch {
    return { ok: false, path: audioUrl };
  }
  if (!blob || cancelled?.()) {
    return { ok: false, path: audioUrl };
  }

  await putLocalMediaBlob({
    mediafileId,
    projectId,
    status: 'cloudBacked',
    blob,
    contentType: blob.type || undefined,
  });

  return { ok: true, path: localMediaPath(mediafileId) };
};
