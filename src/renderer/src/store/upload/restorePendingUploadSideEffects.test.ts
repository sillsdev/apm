import { UploadType } from '../../components/UploadType';
import type { PendingUploadMediaRecord } from './pendingMediaUploads';
import { restorePendingUploadSideEffects } from './restorePendingUploadSideEffects';

const createIntellectualPropertyForMedia = jest.fn();
const saveMediaTranscription = jest.fn();

jest.mock('../../crud/createIntellectualPropertyForMedia', () => ({
  createIntellectualPropertyForMedia: (...args: unknown[]) =>
    createIntellectualPropertyForMedia(...args),
}));
jest.mock('../../crud/saveMediaTranscription', () => ({
  saveMediaTranscription: (...args: unknown[]) =>
    saveMediaTranscription(...args),
}));

const baseRecord = {
  planId: 'plan-1',
  versionNumber: 1,
  originalFile: 'speaker.wav',
  contentType: 'audio/wav',
  artifactTypeId: '',
  passageId: '',
  userId: 'user-1',
  recordedbyUserId: 'user-1',
  sourceMediaId: '',
  sourceSegments: '{}',
  performedBy: 'Ada',
} as PendingUploadMediaRecord;

describe('restorePendingUploadSideEffects', () => {
  const memory = { update: jest.fn() } as unknown as import('@orbit/memory').default;

  beforeEach(() => {
    jest.clearAllMocks();
    createIntellectualPropertyForMedia.mockResolvedValue(undefined);
  });

  it('creates intellectual property for an IP pending upload', async () => {
    await restorePendingUploadSideEffects({
      entry: {
        id: 'p1',
        failedAt: '2026-01-01T00:00:00.000Z',
        localAbsolutePath: '/speaker.wav',
        fileSize: 10,
        uploadType: UploadType.IntellectualProperty,
        record: baseRecord,
        sideEffects: {
          kind: 'intellectualProperty',
          rightsHolder: 'Ada',
          statement: 'I grant permission',
          organizationId: 'org-1',
        },
      },
      mediaId: 'media-99',
      memory,
      user: 'user-1',
    });

    expect(createIntellectualPropertyForMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        mediaId: 'media-99',
        rightsHolder: 'Ada',
        organizationId: 'org-1',
        transcription: 'I grant permission',
        user: 'user-1',
        memory,
      })
    );
  });

  it('attaches comment media after a successful retry', async () => {
    const saveComment = jest.fn().mockResolvedValue(true);

    await restorePendingUploadSideEffects({
      entry: {
        id: 'p2',
        failedAt: '2026-01-01T00:00:00.000Z',
        localAbsolutePath: '/comment.wav',
        fileSize: 10,
        uploadType: UploadType.Media,
        record: { ...baseRecord, passageId: 'psg-1' },
        sideEffects: {
          kind: 'comment',
          discussionId: 'disc-1',
          commentId: 'cmt-1',
          commentText: 'hello',
        },
      },
      mediaId: 'media-5',
      memory,
      user: 'user-1',
      saveComment,
    });

    expect(saveComment).toHaveBeenCalledWith(
      'disc-1',
      'cmt-1',
      'hello',
      'media-5'
    );
    expect(createIntellectualPropertyForMedia).not.toHaveBeenCalled();
  });

  it('does nothing for a vernacular take with no side effects', async () => {
    const saveComment = jest.fn();
    await restorePendingUploadSideEffects({
      entry: {
        id: 'p3',
        failedAt: '2026-01-01T00:00:00.000Z',
        localAbsolutePath: '/take.wav',
        fileSize: 10,
        uploadType: UploadType.Media,
        record: { ...baseRecord, passageId: 'psg-1', performedBy: '' },
      },
      mediaId: 'media-1',
      memory,
      user: 'user-1',
      saveComment,
    });

    expect(createIntellectualPropertyForMedia).not.toHaveBeenCalled();
    expect(saveComment).not.toHaveBeenCalled();
  });
});
