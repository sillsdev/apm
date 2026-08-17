import { UploadType } from '../../components/UploadType';
import {
  appendPendingMediaUpload,
  loadPendingMediaUploads,
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
});
