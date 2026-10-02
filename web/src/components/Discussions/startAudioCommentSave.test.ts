import { describe, expect, it, beforeEach } from '@jest/globals';
import MemorySource from '@orbit/memory';
import {
  RecordSchema,
  RecordOperation,
  RecordTransformBuilder,
} from '@orbit/records';
import { related } from '../../crud/related';
import {
  AddRecord,
  UpdateRelatedRecord,
  UpdateRecord,
} from '../../model/baseModel';
import { restoreAfterPendingUpload } from '../../store/upload/restoreAfterPendingUpload';
import type { PendingUploadRestore } from '../../store/upload/pendingMediaUploads';
import {
  audioCommentPendingRestore,
  startAudioCommentSave,
} from './startAudioCommentSave';
import { CommentD, DiscussionD } from '../../model';

/**
 * TT-7363 (reopen, 2026-09-16): "Audio Translation and Audio Comment files
 * created while adding discussion appear in the Pending Files dialog. However,
 * after clicking Retry, the files are not restored to their appropriate
 * locations."
 *
 * `pendingRestore` is evaluated while `nextUpload` stages the upload, which for
 * a discussion card with audio happens *before* `afterUploadCb` writes the
 * discussion. On a brand-new discussion the card therefore hands the pending row
 * no `discussionId`, so Home → Retry re-uploads the media with nothing to attach
 * the comment to.
 *
 * The test replays that production sequence against a real Orbit memory source
 * and a real `restoreAfterPendingUpload`, so it asserts what the user sees: the
 * audio comment is back on its discussion after Retry.
 */
const schema = new RecordSchema({
  models: {
    user: {
      attributes: {},
      relationships: { lastModifiedByUser: { kind: 'hasOne', type: 'user' } },
    },
    mediafile: {
      attributes: {
        originalFile: { type: 'string' },
        versionNumber: { type: 'number' },
        dateCreated: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: { lastModifiedByUser: { kind: 'hasOne', type: 'user' } },
    },
    discussion: {
      attributes: {
        subject: { type: 'string' },
        dateCreated: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: {
        mediafile: { kind: 'hasOne', type: 'mediafile' },
        creatorUser: { kind: 'hasOne', type: 'user' },
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
    comment: {
      attributes: {
        commentText: { type: 'string' },
        visible: { type: 'string' },
        dateCreated: { type: 'string' },
        dateUpdated: { type: 'string' },
      },
      relationships: {
        discussion: { kind: 'hasOne', type: 'discussion' },
        mediafile: { kind: 'hasOne', type: 'mediafile' },
        creatorUser: { kind: 'hasOne', type: 'user' },
        lastModifiedByUser: { kind: 'hasOne', type: 'user' },
      },
    },
  },
});

describe('new discussion with an audio comment (TT-7363)', () => {
  let memory: MemorySource;
  const user = 'user-1';
  const commentText = 'Please check this phrase';

  beforeEach(async () => {
    memory = new MemorySource({ schema });
    await memory.update((t) => [
      t.addRecord({ type: 'user', id: user, attributes: {} }),
      t.addRecord({
        type: 'mediafile',
        id: 'vern-1',
        attributes: { versionNumber: 1 },
      }),
      // The comment's own recording, already pulled back by Retry.
      t.addRecord({
        type: 'mediafile',
        id: 'comment-media-1',
        attributes: { originalFile: 'comment.mp3', versionNumber: 1 },
      }),
    ]);
  });

  /** DiscussionCard.saveDiscussion, narrowed to the new-discussion branch. */
  const makeSaveDiscussion =
    (discussion: DiscussionD) => async (): Promise<void> => {
      const t = new RecordTransformBuilder();
      const ops: RecordOperation[] = [];
      if (!discussion.id) {
        ops.push(...AddRecord(t, discussion, user, memory));
        ops.push(
          ...UpdateRelatedRecord(
            t,
            discussion,
            'creatorUser',
            'user',
            user,
            user
          )
        );
        ops.push(
          ...UpdateRelatedRecord(
            t,
            discussion,
            'mediafile',
            'mediafile',
            'vern-1',
            user
          )
        );
      } else ops.push(...UpdateRecord(t, discussion, user));
      await memory.update(ops);
    };

  /**
   * Runs the card's save for a new discussion whose comment has audio and
   * returns the restore metadata the pending row would be staged with.
   */
  const saveNewDiscussionWithAudio = async (discussion: DiscussionD) => {
    let restore: PendingUploadRestore | undefined;
    const started = await startAudioCommentSave({
      isBlobReady: () => true,
      waitForBlob: () => Promise.resolve(),
      discussionId: () => discussion.id,
      saveDiscussion: makeSaveDiscussion(discussion),
      // MediaRecord -> useMediaUpload -> nextUpload evaluates pendingRestore
      // here, as the upload is staged.
      startSave: () => {
        restore = audioCommentPendingRestore({
          discussionId: discussion.id,
          commentText,
          visible: '{}',
        });
      },
    });
    return { started, restore };
  };

  const newDiscussion = () =>
    ({
      type: 'discussion',
      attributes: { subject: 'New topic' },
    }) as unknown as DiscussionD;

  it('queues the audio comment with the discussion it belongs to', async () => {
    const discussion = newDiscussion();

    const { started, restore } = await saveNewDiscussionWithAudio(discussion);

    expect(started).toBe(true);
    expect(restore).toEqual(
      expect.objectContaining({ kind: 'comment', text: commentText })
    );
    expect((restore as { discussionId?: string })?.discussionId).toBeTruthy();
  });

  it('restores the audio comment onto its discussion after Retry', async () => {
    const discussion = newDiscussion();

    // Offline: the upload fails and the row is queued carrying `restore`.
    const { restore } = await saveNewDiscussionWithAudio(discussion);

    // Home -> Pending Media Uploads -> Retry: the media uploads, then the
    // persisted restore metadata is replayed.
    await restoreAfterPendingUpload({
      mediaId: 'comment-media-1',
      restore: restore as PendingUploadRestore,
      memory,
      user,
    });

    const comments = memory.cache.query((q) =>
      q.findRecords('comment')
    ) as CommentD[];
    expect(comments).toHaveLength(1);
    expect(comments[0].attributes.commentText).toBe(commentText);
    expect(related(comments[0], 'mediafile')).toBe('comment-media-1');
    expect(related(comments[0], 'discussion')).toBe(discussion.id);
  });
});
