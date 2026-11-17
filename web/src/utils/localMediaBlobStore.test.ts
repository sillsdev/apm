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

import { logError } from './logErrorService';
import {
  LOCAL_MEDIA_DB_NAME,
  closeLocalMediaDb,
  deleteLocalMediaBlob,
  getLocalMediaBlob,
  incrementLocalMediaBlobRetry,
  isLocalMediaBlobRecord,
  listLocalMediaBlobsByProject,
  listLocalMediaBlobsByStatus,
  markLocalMediaBlobCloudBacked,
  putLocalMediaBlob,
  settledMediafileId,
  touchLocalMediaBlob,
} from './localMediaBlobStore';

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

describe('localMediaBlobStore', () => {
  it('saves a recording under its clientTempId and reads the bytes back', async () => {
    const saved = await putLocalMediaBlob({
      clientTempId: 'tmp-1',
      projectId: 'p1',
      status: 'uploadPending',
      blob: audio('hello'),
    });

    expect(saved).toMatchObject({
      key: 'tmp-1',
      status: 'uploadPending',
      size: 5,
      contentType: 'audio/webm',
      retryCount: 0,
    });
    const got = await getLocalMediaBlob('tmp-1');
    expect(await got?.blob.text()).toBe('hello');
  });

  it('rejects a put with neither mediafileId nor clientTempId', async () => {
    await expect(
      putLocalMediaBlob({
        projectId: 'p1',
        status: 'cloudBacked',
        blob: audio(),
      })
    ).rejects.toThrow(/mediafileId or clientTempId/);
  });

  it('returns undefined for an unknown id', async () => {
    expect(await getLocalMediaBlob('missing')).toBeUndefined();
  });

  it('marks Cloud-backed, keeps the bytes, and re-keys to the mediafile id', async () => {
    await putLocalMediaBlob({
      clientTempId: 'tmp-1',
      projectId: 'p1',
      status: 'uploadPending',
      blob: audio('keep me'),
    });

    const marked = await markLocalMediaBlobCloudBacked('tmp-1', 'mf-1');

    expect(marked).toMatchObject({
      key: 'mf-1',
      mediafileId: 'mf-1',
      clientTempId: 'tmp-1',
      status: 'cloudBacked',
    });
    const byMediafile = await getLocalMediaBlob('mf-1');
    const byTemp = await getLocalMediaBlob('tmp-1');
    expect(await byMediafile?.blob.text()).toBe('keep me');
    expect(byTemp?.key).toBe('mf-1');
    expect(await listLocalMediaBlobsByStatus('uploadPending')).toEqual([]);
  });

  it('moves a temp-keyed blob when re-put with its mediafile id, keeping createdAt and retries', async () => {
    await putLocalMediaBlob({
      clientTempId: 'tmp-1',
      projectId: 'p1',
      status: 'uploadPending',
      blob: audio(),
      createdAt: 100,
    });
    await incrementLocalMediaBlobRetry('tmp-1');

    const saved = await putLocalMediaBlob({
      clientTempId: 'tmp-1',
      mediafileId: 'mf-1',
      projectId: 'p1',
      status: 'cloudBacked',
      blob: audio(),
    });

    expect(saved).toMatchObject({ key: 'mf-1', createdAt: 100, retryCount: 1 });
    expect(await listLocalMediaBlobsByProject('p1')).toHaveLength(1);
  });

  it('lists by status and by project, optionally filtered by status', async () => {
    await putLocalMediaBlob({
      clientTempId: 'a',
      projectId: 'p1',
      status: 'uploadPending',
      blob: audio(),
    });
    await putLocalMediaBlob({
      mediafileId: 'b',
      projectId: 'p1',
      status: 'cloudBacked',
      blob: audio(),
    });
    await putLocalMediaBlob({
      mediafileId: 'c',
      projectId: 'p2',
      status: 'cloudBacked',
      blob: audio(),
    });

    const keys = (rows: { key: string }[]) => rows.map((r) => r.key).sort();
    expect(keys(await listLocalMediaBlobsByStatus('cloudBacked'))).toEqual([
      'b',
      'c',
    ]);
    expect(keys(await listLocalMediaBlobsByProject('p1'))).toEqual(['a', 'b']);
    expect(
      keys(await listLocalMediaBlobsByProject('p1', 'cloudBacked'))
    ).toEqual(['b']);
    expect(await listLocalMediaBlobsByProject('p3')).toEqual([]);
  });

  it('counts retries and records last access', async () => {
    await putLocalMediaBlob({
      clientTempId: 'a',
      projectId: 'p1',
      status: 'uploadPending',
      blob: audio(),
    });

    await incrementLocalMediaBlobRetry('a');
    const retried = await incrementLocalMediaBlobRetry('a');
    const touched = await touchLocalMediaBlob('a', 42);

    expect(retried?.retryCount).toBe(2);
    expect(retried?.status).toBe('uploadPending');
    expect(touched?.lastAccessedAt).toBe(42);
  });

  it('returns undefined when updating an unknown id', async () => {
    expect(await markLocalMediaBlobCloudBacked('missing')).toBeUndefined();
    expect(await incrementLocalMediaBlobRetry('missing')).toBeUndefined();
  });

  it('deletes by mediafile id or clientTempId and reports whether it removed one', async () => {
    await putLocalMediaBlob({
      clientTempId: 'tmp-1',
      projectId: 'p1',
      status: 'uploadPending',
      blob: audio(),
    });
    await markLocalMediaBlobCloudBacked('tmp-1', 'mf-1');

    expect(await deleteLocalMediaBlob('tmp-1')).toBe(true);
    expect(await getLocalMediaBlob('mf-1')).toBeUndefined();
    expect(await deleteLocalMediaBlob('mf-1')).toBe(false);
  });

  it('survives reopening the database', async () => {
    await putLocalMediaBlob({
      clientTempId: 'a',
      projectId: 'p1',
      status: 'uploadPending',
      blob: audio('persisted'),
    });
    await closeLocalMediaDb();

    expect(await (await getLocalMediaBlob('a'))?.blob.text()).toBe('persisted');
  });
});

describe('localMediaBlobStore mediafile id is permanent', () => {
  const seedCloudBacked = async () => {
    await putLocalMediaBlob({
      clientTempId: 'tmp-1',
      projectId: 'p1',
      status: 'uploadPending',
      blob: audio('first'),
    });
    await markLocalMediaBlobCloudBacked('tmp-1', 'mf-1');
  };

  it('keeps the mediafile key when re-put with only the clientTempId', async () => {
    await seedCloudBacked();

    const saved = await putLocalMediaBlob({
      clientTempId: 'tmp-1',
      projectId: 'p1',
      status: 'cloudBacked',
      blob: audio('second'),
    });

    expect(saved).toMatchObject({ key: 'mf-1', mediafileId: 'mf-1' });
    expect(await (await getLocalMediaBlob('mf-1'))?.blob.text()).toBe('second');
    expect(await listLocalMediaBlobsByProject('p1')).toHaveLength(1);
  });

  it('rejects a put that would change a known mediafile id and leaves the row intact', async () => {
    await seedCloudBacked();

    await expect(
      putLocalMediaBlob({
        clientTempId: 'tmp-1',
        mediafileId: 'mf-2',
        projectId: 'p1',
        status: 'cloudBacked',
        blob: audio('other'),
      })
    ).rejects.toThrow(/already has mediafile id mf-1/);
    expect(await (await getLocalMediaBlob('mf-1'))?.blob.text()).toBe('first');
    expect(await getLocalMediaBlob('mf-2')).toBeUndefined();
  });

  it('rejects marking Cloud-backed with a different mediafile id', async () => {
    await seedCloudBacked();

    await expect(
      markLocalMediaBlobCloudBacked('tmp-1', 'mf-2')
    ).rejects.toThrow(/already has mediafile id mf-1/);
    expect((await getLocalMediaBlob('tmp-1'))?.key).toBe('mf-1');
  });

  it('allows marking Cloud-backed again with the same mediafile id', async () => {
    await seedCloudBacked();

    expect((await markLocalMediaBlobCloudBacked('tmp-1', 'mf-1'))?.key).toBe(
      'mf-1'
    );
  });
});

describe('settledMediafileId', () => {
  it.each([
    ['nothing known or given', undefined, undefined, undefined],
    ['only a known id', 'mf-1', undefined, 'mf-1'],
    ['only an incoming id', undefined, 'mf-1', 'mf-1'],
    ['the same id twice', 'mf-1', 'mf-1', 'mf-1'],
    ['an empty incoming id', 'mf-1', '', 'mf-1'],
    ['an empty known id', '', 'mf-1', 'mf-1'],
  ])('keeps %s', (_label, known, incoming, expected) => {
    expect(settledMediafileId(known, incoming)).toBe(expected);
  });

  it('throws when the incoming id contradicts the known one', () => {
    expect(() => settledMediafileId('mf-1', 'mf-2')).toThrow(/mf-1.*mf-2/);
  });
});

describe('localMediaBlobStore malformed rows', () => {
  // Simulates a row written by an older build or damaged storage: written
  // straight into the store, bypassing putLocalMediaBlob's shaping.
  const writeRawRow = async (row: object) => {
    // Creates the schema through the store, then closes so a raw connection
    // can open the same database.
    await getLocalMediaBlob('init');
    await closeLocalMediaDb();
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(LOCAL_MEDIA_DB_NAME);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction('blobs', 'readwrite');
        tx.objectStore('blobs').put(row);
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
      };
    });
  };

  const malformed = {
    key: 'bad-1',
    projectId: 'p1',
    status: 'uploadPending',
    blob: 'not a blob',
  };

  it('leaves a malformed row out of lists and reports it', async () => {
    await writeRawRow(malformed);

    expect(await listLocalMediaBlobsByProject('p1')).toEqual([]);
    expect(logError).toHaveBeenCalledWith(
      1,
      expect.anything(),
      expect.stringContaining('bad-1')
    );
  });

  it('treats a malformed row as not found on get and reports it', async () => {
    await writeRawRow(malformed);

    expect(await getLocalMediaBlob('bad-1')).toBeUndefined();
    expect(logError).toHaveBeenCalledWith(
      1,
      expect.anything(),
      expect.stringContaining('bad-1')
    );
  });

  it('does not report a plain not-found', async () => {
    expect(await getLocalMediaBlob('missing')).toBeUndefined();
    expect(logError).not.toHaveBeenCalled();
  });
});

describe('localMediaBlobStore durability', () => {
  // Durability is the store's contract with the browser (see the module
  // header): strict for writes that create or end Upload Pending, relaxed for
  // Cloud-backed copies and bookkeeping.
  const lastWriteDurability = async (write: () => Promise<unknown>) => {
    const spy = jest.spyOn(IDBDatabase.prototype, 'transaction');
    try {
      await write();
      const writes = spy.mock.calls.filter(([, mode]) => mode === 'readwrite');
      return writes[writes.length - 1]?.[2]?.durability;
    } finally {
      spy.mockRestore();
    }
  };

  const seedPending = () =>
    putLocalMediaBlob({
      clientTempId: 'tmp-1',
      projectId: 'p1',
      status: 'uploadPending',
      blob: audio(),
    });

  it('saves Upload Pending strictly', async () => {
    expect(await lastWriteDurability(seedPending)).toBe('strict');
  });

  it('saves a Cloud-backed download relaxed', async () => {
    expect(
      await lastWriteDurability(() =>
        putLocalMediaBlob({
          mediafileId: 'mf-1',
          projectId: 'p1',
          status: 'cloudBacked',
          blob: audio(),
        })
      )
    ).toBe('relaxed');
  });

  it('marks Cloud-backed strictly because it ends Upload Pending', async () => {
    await seedPending();
    expect(
      await lastWriteDurability(() =>
        markLocalMediaBlobCloudBacked('tmp-1', 'mf-1')
      )
    ).toBe('strict');
  });

  it('records retries and access time relaxed', async () => {
    await seedPending();
    expect(
      await lastWriteDurability(() => incrementLocalMediaBlobRetry('tmp-1'))
    ).toBe('relaxed');
    expect(await lastWriteDurability(() => touchLocalMediaBlob('tmp-1'))).toBe(
      'relaxed'
    );
  });

  it('deletes strictly', async () => {
    await seedPending();
    expect(await lastWriteDurability(() => deleteLocalMediaBlob('tmp-1'))).toBe(
      'strict'
    );
  });
});

describe('isLocalMediaBlobRecord', () => {
  const valid = {
    key: 'k',
    projectId: 'p',
    status: 'cloudBacked',
    blob: audio(),
    contentType: 'audio/webm',
    size: 3,
    createdAt: 1,
    retryCount: 0,
  };

  it('accepts a well-formed row', () => {
    expect(isLocalMediaBlobRecord(valid)).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'k'],
    ['an empty key', { ...valid, key: '' }],
    ['an unknown status', { ...valid, status: 'synced' }],
    ['a non-Blob blob', { ...valid, blob: 'bytes' }],
    ['a non-numeric size', { ...valid, size: '3' }],
    ['a non-string mediafileId', { ...valid, mediafileId: 7 }],
  ])('rejects %s', (_label, row) => {
    expect(isLocalMediaBlobRecord(row)).toBe(false);
  });
});
