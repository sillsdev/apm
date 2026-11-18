import { loadBlobAsync } from './loadBlob';
import { putCloudBackedLocalMediaBlobIfAbsent } from './localMediaBlobStore';
import { localMediaPath } from './localMediaPath';
import { logError, Severity } from './logErrorService';

type Reporter = Parameters<typeof logError>[1];

export interface DownloadCloudMediaToLocalBlobProps {
  mediafileId: string;
  projectId: string;
  audioUrl: string;
  reporter: Reporter;
  cancelled?: () => boolean;
}

export interface DownloadCloudMediaToLocalBlobResult {
  ok: boolean;
  path: string;
}

/**
 * Persist cloud media bytes as a Cloud-backed Local Media Blob. The caller
 * checks first whether this device already has the blob, so the server is
 * not asked for a url it doesn't need.
 *
 * Failures are not fatal: the cloud url still plays, so the result is
 * `ok: false` with that url. A failed download or IndexedDB write (storage
 * full, private browsing) is reported, because offline prep then leaves the
 * file missing.
 */
export const downloadCloudMediaToLocalBlob = async (
  props: DownloadCloudMediaToLocalBlobProps
): Promise<DownloadCloudMediaToLocalBlobResult> => {
  const { mediafileId, projectId, audioUrl, reporter, cancelled } = props;
  const failed = { ok: false, path: audioUrl || '' };
  if (!mediafileId || !projectId || !audioUrl) return failed;
  if (cancelled?.()) return failed;

  let blob: Blob | undefined;
  try {
    blob = await loadBlobAsync(audioUrl);
  } catch (err) {
    logError(
      Severity.error,
      reporter,
      `Cloud media download failed for ${mediafileId}: ${String(err)}`
    );
    return failed;
  }
  if (!blob || cancelled?.()) return failed;

  try {
    await putCloudBackedLocalMediaBlobIfAbsent({
      mediafileId,
      projectId,
      blob,
    });
  } catch (err) {
    logError(
      Severity.error,
      reporter,
      `Local Media Blob write failed for ${mediafileId}: ${String(err)}`
    );
    return failed;
  }
  return { ok: true, path: localMediaPath(mediafileId) };
};
