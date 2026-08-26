import type Memory from '@orbit/memory';
import type { MediaFileD } from '../../model';
import { UploadType } from '../../components/UploadType';
import { createIntellectualPropertyForMedia } from '../../crud/createIntellectualPropertyForMedia';
import { saveMediaTranscription } from '../../crud/saveMediaTranscription';
import type { PendingUploadRecord } from './pendingMediaUploads';

export interface RestorePendingUploadSideEffectsParams {
  entry: PendingUploadRecord;
  mediaId: string;
  memory: Memory;
  user: string;
  organizationId?: string;
  saveComment?: (
    discussionId: string,
    commentId: string,
    commentText: string,
    mediaId: string,
    approved: boolean | undefined,
    permissions: string | undefined
  ) => Promise<unknown>;
}

export async function restorePendingUploadSideEffects({
  entry,
  mediaId,
  memory,
  user,
  organizationId,
  saveComment,
}: RestorePendingUploadSideEffectsParams): Promise<void> {
  if (!mediaId) return;

  const isIp =
    entry.uploadType === UploadType.IntellectualProperty ||
    entry.sideEffects?.kind === 'intellectualProperty';
  if (isIp) {
    const rightsHolder =
      entry.sideEffects?.rightsHolder || entry.record.performedBy || '';
    const orgId = entry.sideEffects?.organizationId || organizationId || '';
    if (rightsHolder && orgId) {
      // Match the in-step path (ProvideRights): with no rights statement,
      // apply no transcription rather than falling back to the speaker name.
      const statement =
        entry.sideEffects?.statement || entry.record.transcription || undefined;
      await createIntellectualPropertyForMedia({
        memory,
        user,
        mediaId,
        rightsHolder,
        organizationId: orgId,
        notes: entry.sideEffects?.notes,
        transcription: statement,
        applyTranscription: (media: MediaFileD, text: string) =>
          saveMediaTranscription(memory, media, text, user),
      });
    }
  }

  const discussionId = entry.sideEffects?.discussionId;
  if (discussionId && saveComment) {
    await saveComment(
      discussionId,
      entry.sideEffects?.commentId || '',
      entry.sideEffects?.commentText || '',
      mediaId,
      entry.sideEffects?.commentApproved,
      entry.sideEffects?.commentVisible
    );
  }
}
