import { RecordOperation, RecordTransformBuilder } from '@orbit/records';
import { useDispatch } from 'react-redux';
import { useGlobal } from '../context/useGlobal';
import { findRecord, PermissionName, remoteIdGuid, usePermissions } from '.';
import { computeCommentVisibleString } from './computeCommentVisible';
import { IApiError, CommentD, MediaFileD } from '../model';
import {
  AddRecord,
  UpdateRecord,
  UpdateRelatedRecord,
  UpdateLastModifiedBy,
  ReplaceRelatedRecord,
} from '../model/baseModel';
import { orbitErr } from '../utils';
import * as actions from '../store';
import { RecordKeyMap } from '@orbit/records';
import remoteId from './remoteId';

export const useSaveComment = () => {
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const dispatch = useDispatch();
  const doOrbitError = (ex: IApiError) =>
    dispatch(actions.doOrbitError(ex) as any);
  const { hasPermission } = usePermissions();
  return async (
    discussionId: string,
    commentId: string,
    commentText: string,
    mediaRemId: string | undefined,
    approved: boolean | undefined,
    permissions?: string
  ) => {
    let mediafile: MediaFileD | undefined = undefined;
    if (mediaRemId) {
      const id =
        remoteIdGuid('mediafile', mediaRemId, memory?.keyMap as RecordKeyMap) ||
        mediaRemId;
      mediafile = findRecord(memory, 'mediafile', id) as MediaFileD;
    }
    const visible = computeCommentVisibleString({
      approved,
      existingPermissions: permissions,
      isCIT: hasPermission(PermissionName.CIT),
      isMentor: hasPermission(PermissionName.Mentor),
      authorId:
        remoteId('user', user, memory?.keyMap as RecordKeyMap)?.toString() ||
        user,
    });

    const t = new RecordTransformBuilder();
    const ops: RecordOperation[] = [];
    let commentRec: CommentD;
    if (commentId) {
      commentRec = findRecord(memory, 'comment', commentId) as CommentD;
      commentRec.attributes.commentText = commentText;
      commentRec.attributes.visible = visible;
      ops.push(...UpdateRecord(t, commentRec, user));
    } else {
      commentRec = {
        type: 'comment',
        attributes: {
          commentText: commentText,
          visible,
        },
      } as CommentD;
      ops.push(
        ...AddRecord(t, commentRec, user, memory),
        ...ReplaceRelatedRecord(
          t,
          commentRec,
          'discussion',
          'discussion',
          discussionId
        ),
        ...ReplaceRelatedRecord(t, commentRec, 'creatorUser', 'user', user)
      );
    }
    if (mediafile?.id) {
      ops.push(
        ...UpdateRelatedRecord(
          t,
          commentRec,
          'mediafile',
          'mediafile',
          mediafile?.id,
          user
        )
      );
    }
    ops.push(
      ...UpdateLastModifiedBy(t, { type: 'discussion', id: discussionId }, user)
    );
    try {
      await memory.update(ops);
      return true;
    } catch (errResult: unknown) {
      const err = errResult as Error;
      doOrbitError(orbitErr(err, 'attach comment media'));
      return false;
    }
  };
};
