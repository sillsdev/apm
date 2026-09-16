import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * TT-7363 (reopen, Dharmaraj 2026-09-16 comment 2): an audio comment recorded
 * *while adding a discussion* is not restored after Retry.
 *
 * `DiscussionCard.pendingRestore` needs `discussion.id`, but for a brand-new
 * discussion that record is only created in `afterUploadCb` — i.e. after a
 * successful upload. `useMediaUpload` evaluates `pendingRestore` when it
 * stages the upload, so an offline failure queues the media with **no**
 * restore metadata and Retry has nowhere to attach it.
 *
 * `useMediaUpload` already awaits `beforeUpload` before capturing
 * `pendingRestore` (see useMediaUpload.test.ts), and `MediaRecord` already
 * accepts `beforeUpload` — `CommentEditor` is the missing link in the chain.
 */

type MediaRecordProps = {
  pendingRestore?: () => unknown;
  beforeUpload?: () => Promise<void>;
  afterUploadCb: (mediaId: string | undefined) => Promise<void>;
};

let capturedRecorder: MediaRecordProps | undefined;

jest.mock('../MediaRecord', () => ({
  __esModule: true,
  default: (props: MediaRecordProps) => {
    capturedRecorder = props;
    return <div data-testid="media-record" />;
  },
}));

jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(),
  useSelector: (sel: (state: unknown) => unknown) => sel({}),
}));

jest.mock('../../selector', () => ({
  commentEditorSelector: () => ({
    comment: 'Comment',
    record: 'Record',
    recordUnavailable: 'Recording unavailable',
    saving: 'Saving',
  }),
  sharedSelector: () => ({ cancel: 'Cancel', save: 'Save' }),
}));

jest.mock('../../crud', () => ({
  useArtifactType: () => ({ commentId: 'comment-artifact' }),
}));

jest.mock('../../utils', () => ({
  waitForIt: jest.fn(async () => true),
}));

jest.mock('../../context/PassageDetailContext', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    PassageDetailContext: ReactActual.createContext({
      state: {
        playing: false,
        itemPlaying: false,
        commentPlaying: false,
        commentRecording: false,
        setCommentRecording: jest.fn(),
      },
    }),
  };
});

jest.mock('../../context/UnsavedContext', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    UnsavedContext: ReactActual.createContext({
      state: {
        toolsChanged: {},
        toolChanged: jest.fn(),
        startSave: jest.fn(),
        saveRequested: () => false,
        clearRequested: () => false,
        clearCompleted: jest.fn(),
        isChanged: () => false,
      },
    }),
  };
});

import { CommentEditor } from './CommentEditor';

// The Record control is an icon-only button, so target its stable id.
const openRecorder = async () => {
  await userEvent.click(document.querySelector('#record') as HTMLElement);
  await act(async () => {
    await Promise.resolve();
  });
};

describe('CommentEditor pending-upload restore wiring (TT-7363)', () => {
  beforeEach(() => {
    capturedRecorder = undefined;
  });

  afterEach(cleanup);

  it('forwards beforeUpload to MediaRecord so a new discussion exists before pendingRestore is captured', async () => {
    const created: string[] = [];
    // Stands in for DiscussionCard.saveDiscussion: creates the discussion
    // record and gives it an id.
    const beforeUpload = jest.fn(async () => {
      created.push('discussion-1');
    });
    const pendingRestore = jest.fn(() => ({
      kind: 'comment' as const,
      discussionId: created[0] ?? '',
      text: 'my comment',
    }));

    render(
      <CommentEditor
        toolId="new-comment"
        passageId="pas-1"
        comment=""
        fileName="comment.wav"
        refresh={0}
        afterUploadCb={jest.fn(async () => {})}
        pendingRestore={pendingRestore}
        beforeUpload={beforeUpload}
        setCanSaveRecording={jest.fn()}
        onTextChange={jest.fn()}
      />
    );

    await openRecorder();

    expect(capturedRecorder?.beforeUpload).toBe(beforeUpload);

    // The chain MediaRecord → useMediaUpload guarantees beforeUpload resolves
    // before pendingRestore is read; the queued row must then carry the id.
    await capturedRecorder!.beforeUpload!();
    expect(capturedRecorder?.pendingRestore?.()).toEqual({
      kind: 'comment',
      discussionId: 'discussion-1',
      text: 'my comment',
    });
  });

  it('still forwards pendingRestore when no beforeUpload is supplied', async () => {
    const pendingRestore = jest.fn(() => ({
      kind: 'comment' as const,
      discussionId: 'discussion-9',
      text: 'reply',
    }));

    render(
      <CommentEditor
        toolId="reply"
        passageId="pas-1"
        comment=""
        fileName="reply.wav"
        refresh={0}
        afterUploadCb={jest.fn(async () => {})}
        pendingRestore={pendingRestore}
        setCanSaveRecording={jest.fn()}
        onTextChange={jest.fn()}
      />
    );

    await openRecorder();

    expect(capturedRecorder?.pendingRestore).toBe(pendingRestore);
    expect(capturedRecorder?.beforeUpload).toBeUndefined();
  });
});
