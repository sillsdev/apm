/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto';

jest.mock('../auth/bugsnagClient', () => ({ __esModule: true, default: {} }));
const mockLogError = jest.fn();
jest.mock('./logErrorService', () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
  Severity: { info: 0, error: 1, retry: 2 },
}));

const mockLoadBlobAsync = jest.fn();
jest.mock('./loadBlob', () => ({
  loadBlobAsync: (...args: unknown[]) => mockLoadBlobAsync(...args),
}));

import * as store from './localMediaBlobStore';
import {
  LOCAL_MEDIA_DB_NAME,
  closeLocalMediaDb,
  getLocalMediaBlob,
  putLocalMediaBlob,
} from './localMediaBlobStore';
import { isLocalMediaPath, localMediaPath } from './localMediaPath';
import { downloadCloudMediaToLocalBlob } from './downloadCloudMediaToLocalBlob';

const audio = (text = 'cloud-bytes') =>
  new Blob([text], { type: 'audio/mpeg' });

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(LOCAL_MEDIA_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

afterEach(async () => {
  mockLoadBlobAsync.mockReset();
  mockLogError.mockReset();
  jest.restoreAllMocks();
  await closeLocalMediaDb();
  await deleteDb();
});

describe('downloadCloudMediaToLocalBlob', () => {
  const mediafileId = 'mf-1';
  const projectId = 'proj-1';
  const audioUrl = 'https://cdn.example/a.mp3?sig=1';
  const reporter = 'test-reporter';

  it('saves cloud bytes as a cloudBacked Local Media Blob', async () => {
    const blob = audio();
    mockLoadBlobAsync.mockResolvedValue(blob);

    const result = await downloadCloudMediaToLocalBlob({
      mediafileId,
      projectId,
      audioUrl,
      reporter,
    });

    expect(result).toEqual({ ok: true, path: localMediaPath(mediafileId) });
    expect(isLocalMediaPath(result.path)).toBe(true);
    expect(mockLoadBlobAsync).toHaveBeenCalledWith(audioUrl);

    const stored = await getLocalMediaBlob(mediafileId);
    expect(stored).toMatchObject({
      mediafileId,
      projectId,
      status: 'cloudBacked',
      size: blob.size,
    });
    expect(await stored!.blob.text()).toBe('cloud-bytes');
  });

  it('never replaces an Upload Pending recording saved meanwhile', async () => {
    mockLoadBlobAsync.mockImplementation(async () => {
      // A recording lands while the cloud bytes are in flight.
      await putLocalMediaBlob({
        mediafileId,
        projectId,
        status: 'uploadPending',
        blob: audio('recording'),
      });
      return audio();
    });

    const result = await downloadCloudMediaToLocalBlob({
      mediafileId,
      projectId,
      audioUrl,
      reporter,
    });

    expect(result.ok).toBe(true);
    const stored = await getLocalMediaBlob(mediafileId);
    expect(stored?.status).toBe('uploadPending');
    expect(await stored!.blob.text()).toBe('recording');
  });

  it('reports and returns not ok when the cloud fetch fails', async () => {
    mockLoadBlobAsync.mockRejectedValue(new Error('404'));

    const result = await downloadCloudMediaToLocalBlob({
      mediafileId,
      projectId,
      audioUrl,
      reporter,
    });

    expect(result).toEqual({ ok: false, path: audioUrl });
    expect(mockLogError).toHaveBeenCalledWith(
      1,
      reporter,
      expect.stringContaining('download failed')
    );
    expect(await getLocalMediaBlob(mediafileId)).toBeUndefined();
  });

  it('reports and returns not ok when the IndexedDB write fails', async () => {
    mockLoadBlobAsync.mockResolvedValue(audio());
    jest
      .spyOn(store, 'putCloudBackedLocalMediaBlobIfAbsent')
      .mockRejectedValue(new Error('QuotaExceededError'));

    const result = await downloadCloudMediaToLocalBlob({
      mediafileId,
      projectId,
      audioUrl,
      reporter,
    });

    expect(result).toEqual({ ok: false, path: audioUrl });
    expect(mockLogError).toHaveBeenCalledWith(
      1,
      reporter,
      expect.stringContaining('write failed')
    );
  });

  it('returns not ok when cancelled after the cloud fetch', async () => {
    let cancel = false;
    mockLoadBlobAsync.mockImplementation(async () => {
      cancel = true;
      return audio();
    });

    const result = await downloadCloudMediaToLocalBlob({
      mediafileId,
      projectId,
      audioUrl,
      reporter,
      cancelled: () => cancel,
    });

    expect(result).toEqual({ ok: false, path: audioUrl });
    expect(mockLoadBlobAsync).toHaveBeenCalled();
    expect(await getLocalMediaBlob(mediafileId)).toBeUndefined();
  });
});
