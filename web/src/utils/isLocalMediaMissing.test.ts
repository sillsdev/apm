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

import * as store from './localMediaBlobStore';
import {
  LOCAL_MEDIA_DB_NAME,
  closeLocalMediaDb,
  putLocalMediaBlob,
} from './localMediaBlobStore';
import { isLocalMediaMissing } from './isLocalMediaMissing';

const reporter = 'test-reporter';

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(LOCAL_MEDIA_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

afterEach(async () => {
  mockLogError.mockReset();
  jest.restoreAllMocks();
  await closeLocalMediaDb();
  await deleteDb();
});

describe('isLocalMediaMissing', () => {
  it('is missing when IndexedDB has no Local Media Blob', async () => {
    expect(await isLocalMediaMissing('mf-absent', reporter)).toBe(true);
  });

  it('is not missing when a Local Media Blob is present', async () => {
    await putLocalMediaBlob({
      mediafileId: 'mf-1',
      projectId: 'p1',
      status: 'cloudBacked',
      blob: new Blob(['x'], { type: 'audio/mpeg' }),
    });
    expect(await isLocalMediaMissing('mf-1', reporter)).toBe(false);
  });

  it('treats an empty id as missing', async () => {
    expect(await isLocalMediaMissing('', reporter)).toBe(true);
  });

  it('logs a failed read and treats it as missing', async () => {
    jest
      .spyOn(store, 'getLocalMediaBlob')
      .mockRejectedValue(new Error('blocked'));
    expect(await isLocalMediaMissing('mf-1', reporter)).toBe(true);
    expect(mockLogError).toHaveBeenCalledWith(
      0,
      reporter,
      expect.stringContaining('mf-1')
    );
  });
});
