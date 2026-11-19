import {
  getLocalMediaBlob,
  touchLocalMediaBlob,
} from '../utils/localMediaBlobStore';
import { logError, Severity } from '../utils/logErrorService';

type Reporter = Parameters<typeof logError>[1];

/**
 * Web read path (local-first playback): returns the Local Media Blob for a
 * mediafile when this device has one, else undefined so the caller falls back
 * to the cloud. `id` is the Orbit mediafile id, or the clientTempId a
 * recording was saved under before it had one.
 *
 * A failed IndexedDB read (private browsing, cleared or blocked site data) is
 * not fatal here: the cloud copy is still reachable, so it is logged as info
 * and treated as not found.
 */
export const findLocalMediaBlob = async (
  id: string,
  reporter: Reporter
): Promise<Blob | undefined> => {
  if (!id) return undefined;
  let record;
  try {
    record = await getLocalMediaBlob(id);
  } catch (err) {
    logError(
      Severity.info,
      reporter,
      `Local Media Blob read failed for ${id}; using cloud: ${String(err)}`
    );
    return undefined;
  }
  if (!record) return undefined;
  // Feeds later least-recently-used eviction (ADR 0017). Not awaited so
  // playback doesn't wait on a write; a lost timestamp only shifts eviction
  // order, so a failure is logged as info.
  touchLocalMediaBlob(record.key).catch((err: unknown) =>
    logError(
      Severity.info,
      reporter,
      `Local Media Blob touch failed for ${record.key}: ${String(err)}`
    )
  );
  // The store keeps the MIME type beside the bytes; a Blob that lost its
  // type (some writers pass raw bytes) would leave the player guessing.
  return record.blob.type || !record.contentType
    ? record.blob
    : record.blob.slice(0, record.blob.size, record.contentType);
};
