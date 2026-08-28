import { UploadType } from '../../components/UploadType';
import {
  appendPendingMediaUpload,
  hasPendingUploadForPassage,
  loadPendingMediaUploads,
  removeMatchingPendingUploads,
  removePendingMediaUpload,
  subscribePendingMediaUploads,
  type PendingUploadMediaRecord,
  updatePendingMediaUpload,
} from './pendingMediaUploads';

const STORAGE_KEY = 'pendingMediaUploadsV1';

const baseRecord = {
  planId: 'plan-1',
  versionNumber: 1,
  originalFile: 'audio.mp3',
  contentType: 'audio/mpeg',
  artifactTypeId: '',
  passageId: 'passage-1',
  userId: 'user-1',
  recordedbyUserId: 'user-1',
  sourceMediaId: '',
  sourceSegments: '{}',
} as PendingUploadMediaRecord;

describe('pendingMediaUploads', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('updatePendingMediaUpload merges fields and refreshes failedAt', () => {
    const created = appendPendingMediaUpload({
      localAbsolutePath: '/old/path.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: baseRecord,
      id: 'pending-1',
      failedAt: '2020-01-01T00:00:00.000Z',
    });

    const updated = updatePendingMediaUpload('pending-1', {
      localAbsolutePath: '/new/path.mp3',
      fileSize: 200,
    });

    expect(updated).toBeDefined();
    expect(updated?.localAbsolutePath).toBe('/new/path.mp3');
    expect(updated?.fileSize).toBe(200);
    expect(updated?.failedAt).not.toBe(created.failedAt);

    const stored = loadPendingMediaUploads();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('pending-1');
    expect(stored[0].localAbsolutePath).toBe('/new/path.mp3');
  });

  it('updatePendingMediaUpload returns undefined when id is missing', () => {
    expect(
      updatePendingMediaUpload('missing', { fileSize: 1 })
    ).toBeUndefined();
    expect(loadPendingMediaUploads()).toHaveLength(0);
  });

  it('appendPendingMediaUpload dedupes by path and metadata', () => {
    appendPendingMediaUpload({
      localAbsolutePath: '/same/file.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: baseRecord,
    });
    appendPendingMediaUpload({
      localAbsolutePath: '/same/file.mp3',
      fileSize: 999,
      uploadType: UploadType.Media,
      record: baseRecord,
    });

    expect(loadPendingMediaUploads()).toHaveLength(1);
    expect(loadPendingMediaUploads()[0].fileSize).toBe(999);
  });

  it('appendPendingMediaUpload keeps distinct entries when path differs', () => {
    appendPendingMediaUpload({
      localAbsolutePath: '/a/file.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: baseRecord,
    });
    appendPendingMediaUpload({
      localAbsolutePath: '/b/file.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: baseRecord,
    });

    expect(loadPendingMediaUploads()).toHaveLength(2);
    expect(localStorage.getItem(STORAGE_KEY)).toBeTruthy();
  });

  it('subscribePendingMediaUploads notifies on change until unsubscribed', () => {
    const onChange = jest.fn();
    const unsubscribe = subscribePendingMediaUploads(onChange);

    const created = appendPendingMediaUpload({
      localAbsolutePath: '/a/file.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: baseRecord,
    });
    expect(onChange).toHaveBeenCalledTimes(1);

    removePendingMediaUpload(created.id);
    expect(onChange).toHaveBeenCalledTimes(2);

    unsubscribe();
    appendPendingMediaUpload({
      localAbsolutePath: '/b/file.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: baseRecord,
    });
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('removeMatchingPendingUploads removes same identity even when paths differ', () => {
    appendPendingMediaUpload({
      localAbsolutePath: '/a/file.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: baseRecord,
    });
    appendPendingMediaUpload({
      localAbsolutePath: '/b/file.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: baseRecord,
    });
    expect(loadPendingMediaUploads()).toHaveLength(2);

    const removed = removeMatchingPendingUploads({
      planId: 'plan-1',
      passageId: 'passage-1',
      artifactTypeId: '',
      originalFile: 'audio.mp3',
    });

    expect(removed).toBe(2);
    expect(loadPendingMediaUploads()).toHaveLength(0);
  });

  it('removeMatchingPendingUploads keeps rows with a different passage or file', () => {
    appendPendingMediaUpload({
      localAbsolutePath: '/a/file.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: baseRecord,
    });
    appendPendingMediaUpload({
      localAbsolutePath: '/b/other.mp3',
      fileSize: 50,
      uploadType: UploadType.Media,
      record: {
        ...baseRecord,
        originalFile: 'other.mp3',
        passageId: 'passage-2',
      },
    });

    const removed = removeMatchingPendingUploads({
      planId: 'plan-1',
      passageId: 'passage-1',
      artifactTypeId: '',
      originalFile: 'audio.mp3',
    });

    expect(removed).toBe(1);
    const remaining = loadPendingMediaUploads();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].record.originalFile).toBe('other.mp3');
  });

  it('preserves restore metadata on append and update', () => {
    const restore = {
      kind: 'title' as const,
      sectionId: 'sec-1',
    };
    const created = appendPendingMediaUpload({
      localAbsolutePath: '/title/file.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: {
        ...baseRecord,
        artifactTypeId: 'title-type',
        passageId: '',
        originalFile: 'title.mp3',
      },
      restore,
    });
    expect(created.restore).toEqual(restore);
    expect(loadPendingMediaUploads()[0].restore).toEqual(restore);

    const updated = updatePendingMediaUpload(created.id, {
      restore: {
        kind: 'intellectualproperty',
        rightsHolder: 'Speaker',
        organizationId: 'org-1',
      },
    });
    expect(updated?.restore).toEqual({
      kind: 'intellectualproperty',
      rightsHolder: 'Speaker',
      organizationId: 'org-1',
    });
  });
});

describe('hasPendingUploadForPassage (TT-7366)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns false when the queue is empty', () => {
    expect(
      hasPendingUploadForPassage({
        planId: 'plan-1',
        passageId: 'passage-1',
        artifactTypeId: null,
      })
    ).toBe(false);
  });

  it('returns true when a vernacular pending row matches plan and passage', () => {
    appendPendingMediaUpload({
      localAbsolutePath: '/pending/file.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: baseRecord,
    });

    expect(
      hasPendingUploadForPassage({
        planId: 'plan-1',
        passageId: 'passage-1',
        artifactTypeId: null,
      })
    ).toBe(true);
  });

  it('returns false for a different passage or plan', () => {
    appendPendingMediaUpload({
      localAbsolutePath: '/pending/file.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: baseRecord,
    });

    expect(
      hasPendingUploadForPassage({
        planId: 'plan-1',
        passageId: 'passage-other',
        artifactTypeId: null,
      })
    ).toBe(false);
    expect(
      hasPendingUploadForPassage({
        planId: 'plan-other',
        passageId: 'passage-1',
        artifactTypeId: null,
      })
    ).toBe(false);
  });

  it('does not match a non-vernacular pending row when querying vernacular', () => {
    appendPendingMediaUpload({
      localAbsolutePath: '/pending/resource.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: { ...baseRecord, artifactTypeId: 'artifact-resource' },
    });

    expect(
      hasPendingUploadForPassage({
        planId: 'plan-1',
        passageId: 'passage-1',
        artifactTypeId: null,
      })
    ).toBe(false);
  });

  it('treats empty string, null, and undefined artifactTypeId as vernacular', () => {
    appendPendingMediaUpload({
      localAbsolutePath: '/pending/file.mp3',
      fileSize: 100,
      uploadType: UploadType.Media,
      record: { ...baseRecord, artifactTypeId: '' },
    });

    expect(
      hasPendingUploadForPassage({
        planId: 'plan-1',
        passageId: 'passage-1',
        artifactTypeId: null,
      })
    ).toBe(true);
    expect(
      hasPendingUploadForPassage({
        planId: 'plan-1',
        passageId: 'passage-1',
        artifactTypeId: undefined,
      })
    ).toBe(true);
    expect(
      hasPendingUploadForPassage({
        planId: 'plan-1',
        passageId: 'passage-1',
        artifactTypeId: '',
      })
    ).toBe(true);
  });
});
