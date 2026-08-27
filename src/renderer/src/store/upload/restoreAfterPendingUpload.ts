import Memory from '@orbit/memory';
import {
  RecordIdentity,
  RecordKeyMap,
  RecordOperation,
  RecordTransformBuilder,
  UninitializedRecord,
} from '@orbit/records';
import { findRecord } from '../../crud/tryFindRecord';
import { related } from '../../crud/related';
import { remoteIdGuid } from '../../crud/remoteId';
import {
  AddRecord,
  ReplaceRelatedRecord,
  UpdateRelatedRecord,
  UpdateLastModifiedBy,
  UpdateRecord,
} from '../../model/baseModel';
import {
  CommentD,
  IntellectualProperty,
  MediaFileD,
  SectionD,
} from '../../model';
import type { PendingUploadRestore } from './pendingMediaUploads';

export interface RestoreAfterPendingUploadArgs {
  mediaId: string;
  restore: PendingUploadRestore;
  memory: Memory;
  user: string;
}

/**
 * Recreate Orbit secondary links that UI `afterUploadCb` normally creates
 * after a successful media upload. Used by pending-upload Retry (TT-7363).
 */
export async function restoreAfterPendingUpload({
  mediaId,
  restore,
  memory,
  user,
}: RestoreAfterPendingUploadArgs): Promise<void> {
  const localMediaId =
    (memory?.keyMap
      ? remoteIdGuid('mediafile', mediaId, memory.keyMap as RecordKeyMap)
      : undefined) ?? mediaId;

  switch (restore.kind) {
    case 'intellectualproperty':
      await restoreIntellectualProperty({
        mediaId: localMediaId,
        restore,
        memory,
        user,
      });
      return;
    case 'comment':
      await restoreComment({
        mediaId: localMediaId,
        restore,
        memory,
        user,
      });
      return;
    case 'title':
      await restoreTitle({
        mediaId: localMediaId,
        restore,
        memory,
        user,
      });
      return;
    default:
      return;
  }
}

async function restoreIntellectualProperty({
  mediaId,
  restore,
  memory,
  user,
}: {
  mediaId: string;
  restore: Extract<PendingUploadRestore, { kind: 'intellectualproperty' }>;
  memory: Memory;
  user: string;
}): Promise<void> {
  if (restore.transcription) {
    const mediaRec = findRecord(memory, 'mediafile', mediaId) as
      | MediaFileD
      | undefined;
    if (mediaRec) {
      await memory.update((t) =>
        UpdateRecord(
          t,
          {
            ...mediaRec,
            attributes: {
              ...mediaRec.attributes,
              transcription: restore.transcription,
            },
          } as MediaFileD,
          user
        )
      );
    }
  }

  const ip = {
    type: 'intellectualproperty',
    attributes: {
      rightsHolder: restore.rightsHolder,
      notes: restore.notes ?? '{}',
    },
  } as IntellectualProperty & UninitializedRecord;

  await memory.update((t) => [
    ...AddRecord(t, ip, user, memory),
    ...ReplaceRelatedRecord(
      t,
      ip as RecordIdentity,
      'releaseMediafile',
      'mediafile',
      mediaId
    ),
    ...ReplaceRelatedRecord(
      t,
      ip as RecordIdentity,
      'organization',
      'organization',
      restore.organizationId
    ),
  ]);
}

async function restoreComment({
  mediaId,
  restore,
  memory,
  user,
}: {
  mediaId: string;
  restore: Extract<PendingUploadRestore, { kind: 'comment' }>;
  memory: Memory;
  user: string;
}): Promise<void> {
  const mediafile = findRecord(memory, 'mediafile', mediaId) as
    | MediaFileD
    | undefined;
  if (!mediafile?.id) return;

  const t = new RecordTransformBuilder();
  const ops: RecordOperation[] = [];
  let commentRec: CommentD;

  if (restore.commentId) {
    commentRec = findRecord(memory, 'comment', restore.commentId) as CommentD;
    if (!commentRec) return;
    commentRec = {
      ...commentRec,
      attributes: {
        ...commentRec.attributes,
        commentText: restore.text,
      },
    };
    ops.push(...UpdateRecord(t, commentRec, user));
  } else {
    commentRec = {
      type: 'comment',
      attributes: {
        commentText: restore.text,
        visible: '{}',
      },
    } as CommentD;
    ops.push(
      ...AddRecord(t, commentRec, user, memory),
      ...ReplaceRelatedRecord(
        t,
        commentRec,
        'discussion',
        'discussion',
        restore.discussionId
      ),
      ...ReplaceRelatedRecord(t, commentRec, 'creatorUser', 'user', user)
    );
  }

  ops.push(
    ...UpdateRelatedRecord(
      t,
      commentRec,
      'mediafile',
      'mediafile',
      mediafile.id,
      user
    ),
    ...UpdateLastModifiedBy(
      t,
      { type: 'discussion', id: restore.discussionId },
      user
    )
  );

  await memory.update(ops);
}

async function restoreTitle({
  mediaId,
  restore,
  memory,
  user,
}: {
  mediaId: string;
  restore: Extract<PendingUploadRestore, { kind: 'title' }>;
  memory: Memory;
  user: string;
}): Promise<void> {
  const secRec = findRecord(memory, 'section', restore.sectionId) as
    | SectionD
    | undefined;
  if (!secRec) return;
  if (related(secRec, 'titleMediafile') === mediaId) return;

  const t = new RecordTransformBuilder();
  await memory.update(
    UpdateRelatedRecord(
      t,
      secRec,
      'titleMediafile',
      'mediafile',
      mediaId,
      user
    )
  );
}
