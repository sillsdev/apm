import type { PendingUploadRestore } from '../../store/upload/pendingMediaUploads';

export interface AudioCommentPendingRestoreArgs {
  /** Discussion the comment belongs to; '' while the card is still unsaved. */
  discussionId: string;
  /** Comment being edited, or '' / undefined when adding a new one. */
  commentId?: string;
  commentText: string;
  /** JSON string from `computeCommentVisibleString`. */
  visible: string;
}

/**
 * Restore metadata persisted on the pending-upload row for an audio comment, so
 * Home → Retry can recreate the comment after the media re-uploads (TT-7363).
 *
 * Returns `undefined` when there is no discussion to attach the comment to —
 * see {@link startAudioCommentSave} for why the caller must make sure there is.
 */
export const audioCommentPendingRestore = ({
  discussionId,
  commentId,
  commentText,
  visible,
}: AudioCommentPendingRestoreArgs): PendingUploadRestore | undefined =>
  discussionId
    ? {
        kind: 'comment',
        discussionId,
        ...(commentId ? { commentId } : {}),
        text: commentText,
        visible,
      }
    : undefined;

export interface StartAudioCommentSaveArgs {
  /** True once MediaRecord holds a blob it can upload. */
  isBlobReady: () => boolean;
  /** Resolves when the blob becomes ready; rejects if it never does. */
  waitForBlob: () => Promise<unknown>;
  /** Current discussion record id; '' while the card has never been saved. */
  discussionId: () => string;
  /** Writes the discussion to Orbit. Local-only, so it succeeds offline. */
  saveDiscussion: () => Promise<void>;
  /** Hands the save request to MediaRecord, which starts the upload. */
  startSave: () => void;
}

/**
 * Save sequence for a discussion card whose comment carries audio: the upload
 * is kicked off here and the rest of the save finishes in `afterUploadCb`.
 *
 * The discussion is written to Orbit **before** the upload starts. `nextUpload`
 * evaluates `pendingRestore` while it stages the file, so on a brand-new
 * discussion the queued row would otherwise carry no `discussionId` and Home →
 * Retry would re-upload the media with nothing to attach the comment to — and,
 * because `afterUploadCb` never runs on a failed upload, the discussion itself
 * would be lost too (TT-7363). The write is local Orbit, so it succeeds offline.
 *
 * @returns `false` when the take never became uploadable, so the caller can
 * release its saving latch.
 */
export const startAudioCommentSave = async ({
  isBlobReady,
  waitForBlob,
  discussionId,
  saveDiscussion,
  startSave,
}: StartAudioCommentSaveArgs): Promise<boolean> => {
  // hasAudioDraft is set on pause before canSaveRecording; MediaRecord
  // completes save immediately if startSave runs without a blob.
  if (!isBlobReady()) {
    try {
      await waitForBlob();
    } catch {
      return false;
    }
  }
  if (!discussionId()) await saveDiscussion();
  startSave();
  return true;
};
