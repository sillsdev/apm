/**
 * @jest-environment node
 */
// Node environment: fake-indexeddb structured-clones values, and Node's native
// Blob survives that clone where jsdom's Blob does not.
import 'fake-indexeddb/auto';

jest.mock('../auth/bugsnagClient', () => ({ __esModule: true, default: {} }));
jest.mock('./logErrorService', () => ({
  logError: jest.fn(),
  Severity: { info: 0, error: 1, retry: 2 },
}));

import {
  LOCAL_MEDIA_DB_NAME,
  closeLocalMediaDb,
  getLocalMediaBlob,
  listLocalMediaBlobsByProject,
  putLocalMediaBlob,
} from './localMediaBlobStore';
import {
  discardUploadPendingLocalMedia,
  estimateCloudBackedLocalMediaBytes,
  evictCloudBackedLocalMedia,
  evictLocalMediaForProjectSwitch,
} from './evictLocalMediaBlobs';

const audio = (text = 'abc') => new Blob([text], { type: 'audio/webm' });

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

const seedProject = async (projectId: string) => {
  await putLocalMediaBlob({
    mediafileId: `${projectId}-cloud-1`,
    projectId,
    status: 'cloudBacked',
    blob: audio(`${projectId}-cloud`),
  });
  await putLocalMediaBlob({
    clientTempId: `${projectId}-pending-1`,
    projectId,
    status: 'uploadPending',
    blob: audio(`${projectId}-pending`),
  });
};

describe('evictCloudBackedLocalMedia', () => {
  it('deletes cloudBacked for project A and keeps uploadPending for A', async () => {
    await seedProject('A');

    const deleted = await evictCloudBackedLocalMedia('A');

    expect(deleted).toBe(1);
    expect(await getLocalMediaBlob('A-cloud-1')).toBeUndefined();
    expect(await getLocalMediaBlob('A-pending-1')).toBeDefined();
    expect(
      await listLocalMediaBlobsByProject('A', 'uploadPending')
    ).toHaveLength(1);
    expect(await listLocalMediaBlobsByProject('A', 'cloudBacked')).toEqual([]);
  });

  it('leaves project B blobs untouched when evicting A', async () => {
    await seedProject('A');
    await seedProject('B');

    await evictCloudBackedLocalMedia('A');

    expect(await getLocalMediaBlob('B-cloud-1')).toBeDefined();
    expect(await getLocalMediaBlob('B-pending-1')).toBeDefined();
    expect(await listLocalMediaBlobsByProject('B')).toHaveLength(2);
  });

  it('returns 0 when the project has no blobs', async () => {
    expect(await evictCloudBackedLocalMedia('empty')).toBe(0);
  });

  it('returns 0 for an empty project id', async () => {
    await seedProject('A');
    expect(await evictCloudBackedLocalMedia('')).toBe(0);
    expect(await listLocalMediaBlobsByProject('A')).toHaveLength(2);
  });
});

describe('evictLocalMediaForProjectSwitch', () => {
  it('evicts only previous project cloudBacked (same as free-space for that id)', async () => {
    await seedProject('prev');
    await seedProject('next');

    const deleted = await evictLocalMediaForProjectSwitch('prev');

    expect(deleted).toBe(1);
    expect(await getLocalMediaBlob('prev-cloud-1')).toBeUndefined();
    expect(await getLocalMediaBlob('prev-pending-1')).toBeDefined();
    expect(await getLocalMediaBlob('next-cloud-1')).toBeDefined();
    expect(await getLocalMediaBlob('next-pending-1')).toBeDefined();
  });
});

describe('estimateCloudBackedLocalMediaBytes', () => {
  it('sums cloudBacked sizes and ignores uploadPending', async () => {
    await putLocalMediaBlob({
      mediafileId: 'c1',
      projectId: 'p1',
      status: 'cloudBacked',
      blob: audio('12345'),
    });
    await putLocalMediaBlob({
      mediafileId: 'c2',
      projectId: 'p1',
      status: 'cloudBacked',
      blob: audio('ab'),
    });
    await putLocalMediaBlob({
      clientTempId: 'u1',
      projectId: 'p1',
      status: 'uploadPending',
      blob: audio('ignored-pending'),
    });

    expect(await estimateCloudBackedLocalMediaBytes('p1')).toBe(5 + 2);
  });

  it('returns 0 when there are no cloudBacked blobs', async () => {
    expect(await estimateCloudBackedLocalMediaBytes('none')).toBe(0);
  });
});

describe('discardUploadPendingLocalMedia', () => {
  it('deletes uploadPending only when called explicitly', async () => {
    await seedProject('A');

    const deleted = await discardUploadPendingLocalMedia('A');

    expect(deleted).toBe(1);
    expect(await getLocalMediaBlob('A-pending-1')).toBeUndefined();
    expect(await getLocalMediaBlob('A-cloud-1')).toBeDefined();
  });

  it('is not used by free-space or project-switch eviction', async () => {
    await seedProject('A');

    await evictCloudBackedLocalMedia('A');
    await evictLocalMediaForProjectSwitch('A');

    expect(await getLocalMediaBlob('A-pending-1')).toBeDefined();
  });
});
