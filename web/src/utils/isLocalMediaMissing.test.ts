/**
 * @jest-environment node
 */
import 'fake-indexeddb/auto';

jest.mock('../auth/bugsnagClient', () => ({ __esModule: true, default: {} }));
jest.mock('./logErrorService', () => ({
  logError: jest.fn(),
  Severity: { info: 0, error: 1, retry: 2 },
}));

import {
  LOCAL_MEDIA_DB_NAME,
  closeLocalMediaDb,
  putLocalMediaBlob,
} from './localMediaBlobStore';
import { isLocalMediaMissing } from './isLocalMediaMissing';

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(LOCAL_MEDIA_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

afterEach(async () => {
  await closeLocalMediaDb();
  await deleteDb();
});

describe('isLocalMediaMissing', () => {
  it('is missing when IndexedDB has no Local Media Blob', async () => {
    expect(await isLocalMediaMissing('mf-absent')).toBe(true);
  });

  it('is not missing when a Local Media Blob is present', async () => {
    await putLocalMediaBlob({
      mediafileId: 'mf-1',
      projectId: 'p1',
      status: 'cloudBacked',
      blob: new Blob(['x'], { type: 'audio/mpeg' }),
    });
    expect(await isLocalMediaMissing('mf-1')).toBe(false);
  });

  it('treats an empty id as missing', async () => {
    expect(await isLocalMediaMissing('')).toBe(true);
  });
});
