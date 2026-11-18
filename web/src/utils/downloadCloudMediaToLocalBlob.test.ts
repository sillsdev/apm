/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto';

jest.mock('../auth/bugsnagClient', () => ({ __esModule: true, default: {} }));
jest.mock('./logErrorService', () => ({
  logError: jest.fn(),
  Severity: { info: 0, error: 1, retry: 2 },
}));

const mockLoadBlobAsync = jest.fn();
jest.mock('./loadBlob', () => ({
  loadBlobAsync: (...args: unknown[]) => mockLoadBlobAsync(...args),
}));

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
  await closeLocalMediaDb();
  await deleteDb();
});

describe('downloadCloudMediaToLocalBlob', () => {
  const mediafileId = 'mf-1';
  const projectId = 'proj-1';
  const audioUrl = 'https://cdn.example/a.mp3?sig=1';

  it('saves cloud bytes as a cloudBacked Local Media Blob', async () => {
    const blob = audio();
    mockLoadBlobAsync.mockResolvedValue(blob);

    const result = await downloadCloudMediaToLocalBlob({
      mediafileId,
      projectId,
      audioUrl,
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

  it('skips the network when this device already has the blob', async () => {
    await putLocalMediaBlob({
      mediafileId,
      projectId,
      status: 'cloudBacked',
      blob: audio('already-here'),
    });

    const result = await downloadCloudMediaToLocalBlob({
      mediafileId,
      projectId,
      audioUrl,
    });

    expect(result.ok).toBe(true);
    expect(result.path).toBe(localMediaPath(mediafileId));
    expect(mockLoadBlobAsync).not.toHaveBeenCalled();
  });

  it('returns not ok when the cloud fetch fails', async () => {
    mockLoadBlobAsync.mockRejectedValue(new Error('404'));

    const result = await downloadCloudMediaToLocalBlob({
      mediafileId,
      projectId,
      audioUrl,
    });

    expect(result).toEqual({ ok: false, path: audioUrl });
    expect(await getLocalMediaBlob(mediafileId)).toBeUndefined();
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
      cancelled: () => cancel,
    });

    expect(result).toEqual({ ok: false, path: audioUrl });
    expect(mockLoadBlobAsync).toHaveBeenCalled();
    expect(await getLocalMediaBlob(mediafileId)).toBeUndefined();
  });
});
