/**
 * @jest-environment node
 */
// Node environment: fake-indexeddb structured-clones values, and Node's native
// Blob survives that clone where jsdom's Blob does not.
import 'fake-indexeddb/auto';

jest.mock('../auth/bugsnagClient', () => ({ __esModule: true, default: {} }));
jest.mock('../utils/logErrorService', () => ({
  logError: jest.fn(),
  Severity: { info: 0, error: 1, retry: 2 },
}));

import { logError } from '../utils/logErrorService';
import {
  LOCAL_MEDIA_DB_NAME,
  closeLocalMediaDb,
  getLocalMediaBlob,
  putLocalMediaBlob,
} from '../utils/localMediaBlobStore';
import * as store from '../utils/localMediaBlobStore';
import { findLocalMediaBlob } from './findLocalMediaBlob';

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(LOCAL_MEDIA_DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

const waitForTouch = async (id: string) => {
  for (let i = 0; i < 20; i++) {
    if ((await getLocalMediaBlob(id))?.lastAccessedAt) return;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('lastAccessedAt never set');
};

describe('findLocalMediaBlob', () => {
  afterEach(async () => {
    jest.restoreAllMocks();
    (logError as jest.Mock).mockReset();
    await closeLocalMediaDb();
    await deleteDb();
  });

  it('returns undefined for an empty id without opening the store', async () => {
    const spy = jest.spyOn(store, 'getLocalMediaBlob');
    await expect(findLocalMediaBlob('', '')).resolves.toBeUndefined();
    expect(spy).not.toHaveBeenCalled();
  });

  it('returns undefined when this device has no blob', async () => {
    await expect(findLocalMediaBlob('mf-1', '')).resolves.toBeUndefined();
  });

  it('returns the blob stored under the mediafile id and records the access', async () => {
    await putLocalMediaBlob({
      mediafileId: 'mf-1',
      projectId: 'p1',
      status: 'cloudBacked',
      blob: new Blob(['abc'], { type: 'audio/mpeg' }),
    });
    const blob = await findLocalMediaBlob('mf-1', '');
    expect(blob?.type).toBe('audio/mpeg');
    expect(await blob?.text()).toBe('abc');
    await waitForTouch('mf-1');
  });

  it('finds an Upload Pending recording by its clientTempId', async () => {
    await putLocalMediaBlob({
      clientTempId: 'tmp-1',
      projectId: 'p1',
      status: 'uploadPending',
      blob: new Blob(['rec'], { type: 'audio/webm' }),
    });
    expect(await (await findLocalMediaBlob('tmp-1', ''))?.text()).toBe('rec');
  });

  it('restores the stored content type when the blob has none', async () => {
    await putLocalMediaBlob({
      mediafileId: 'mf-2',
      projectId: 'p1',
      status: 'cloudBacked',
      blob: new Blob(['xyz']),
      contentType: 'audio/wav',
    });
    const blob = await findLocalMediaBlob('mf-2', '');
    expect(blob?.type).toBe('audio/wav');
    expect(await blob?.text()).toBe('xyz');
  });

  it('treats a failed store read as not found and logs it as info', async () => {
    jest
      .spyOn(store, 'getLocalMediaBlob')
      .mockRejectedValue(new Error('blocked'));
    await expect(findLocalMediaBlob('mf-1', '')).resolves.toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      0,
      '',
      expect.stringContaining('blocked')
    );
  });
});
