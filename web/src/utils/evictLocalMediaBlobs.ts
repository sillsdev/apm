/**
 * Web Local Media Blob eviction (ADR 0017).
 *
 * Free-space and automatic project-switch eviction remove only Cloud-backed
 * blobs for one project. Upload Pending is never touched by those paths —
 * discarding pending requires an explicit caller (step 05 UI confirms first).
 */

import {
  deleteLocalMediaBlob,
  listLocalMediaBlobsByProject,
} from './localMediaBlobStore';

/**
 * Deletes every Cloud-backed Local Media Blob for `projectId`.
 * Returns how many rows were deleted. Never deletes Upload Pending.
 */
export const evictCloudBackedLocalMedia = async (
  projectId: string
): Promise<number> => {
  if (!projectId) return 0;
  const rows = await listLocalMediaBlobsByProject(projectId, 'cloudBacked');
  let deleted = 0;
  for (const row of rows) {
    if (await deleteLocalMediaBlob(row.key)) deleted += 1;
  }
  return deleted;
};

/**
 * After a successful switch away from `previousProjectId`, free that project's
 * Cloud-backed Local Media Blobs. Same bytes as free-space for that project;
 * the separate name documents the ADR call site.
 */
export const evictLocalMediaForProjectSwitch = (
  previousProjectId: string
): Promise<number> => evictCloudBackedLocalMedia(previousProjectId);

/**
 * Sum of Cloud-backed blob sizes for `projectId` (bytes that free-space would
 * reclaim). Does not delete anything.
 */
export const estimateCloudBackedLocalMediaBytes = async (
  projectId: string
): Promise<number> => {
  if (!projectId) return 0;
  const rows = await listLocalMediaBlobsByProject(projectId, 'cloudBacked');
  return rows.reduce((sum, row) => sum + row.size, 0);
};

/**
 * Explicit discard of Upload Pending Local Media Blobs for `projectId`.
 * Call only after a user-confirmed data-loss warning (ADR 0017 / step 05).
 * Free-space and auto project-switch eviction must not call this.
 */
export const discardUploadPendingLocalMedia = async (
  projectId: string
): Promise<number> => {
  if (!projectId) return 0;
  const rows = await listLocalMediaBlobsByProject(projectId, 'uploadPending');
  let deleted = 0;
  for (const row of rows) {
    if (await deleteLocalMediaBlob(row.key)) deleted += 1;
  }
  return deleted;
};
