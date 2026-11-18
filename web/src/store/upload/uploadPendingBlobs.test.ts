/**
 * @jest-environment node
 */
// Node environment: fake-indexeddb structured-clones values, and Node's native
// Blob survives that clone where jsdom's Blob does not.
import 'fake-indexeddb/auto';

jest.mock('../../auth/bugsnagClient', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('../../utils/logErrorService', () => ({
  logError: jest.fn(),
  Severity: { info: 0, error: 1, retry: 2 },
}));
// pendingMediaUploads pulls evictMediaCache → dataPath → window; keep node env.
jest.mock('../../utils/evictMediaCache', () => ({
  evictMediaCache: jest.fn(),
}));

import { UploadType } from '../../components/UploadType';
import {
  LOCAL_MEDIA_DB_NAME,
  closeLocalMediaDb,
  getLocalMediaBlob,
  listLocalMediaBlobsByProject,
  putLocalMediaBlob,
} from '../../utils/localMediaBlobStore';
import { logError } from '../../utils/logErrorService';
import type { PendingUploadMediaRecord } from './pendingMediaUploads';
import {
  claimUploadPending,
  clearUploadPendingForPassage,
  discardUploadPendingBlob,
  discardUploadPendingForProject,
  findUploadPendingKeyForIdentity,
  hasUploadPendingForPassage,
  isUploadPendingInFlight,
  isUploadPendingRequest,
  listUploadPendingEntriesForProjects,
  listUploadPendingEntries,
  recordUploadPendingFailure,
  releaseUploadPending,
  saveUploadPendingBlob,
  settleUploadPending,
  subscribeUploadPendingBlobs,
  uploadPendingBlobCountForProjects,
  type UploadPendingRequest,
} from './uploadPendingBlobs';

const record = (
  over: Partial<PendingUploadMediaRecord> = {}
): PendingUploadMediaRecord =>
  ({
    planId: 'plan1',
    passageId: 'pass1',
    artifactTypeId: '',
    originalFile: 'take.webm',
    contentType: 'audio/webm',
    versionNumber: 1,
    userId: 'u1',
    ...over,
  }) as PendingUploadMediaRecord;

const request = (
  over: Partial<PendingUploadMediaRecord> = {}
): UploadPendingRequest => ({
  uploadType: UploadType.Media,
  record: record(over),
});

const file = (text = 'audio') =>
  new File([text], 'take.webm', { type: 'audio/webm' });

const save = (key: string, over: Partial<PendingUploadMediaRecord> = {}) =>
  saveUploadPendingBlob({
    key,
    projectId: 'proj1',
    file: file(key),
    request: request(over),
  });

const deleteDb = () =>
  new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(LOCAL_MEDIA_DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });

afterEach(async () => {
  await closeLocalMediaDb();
  await deleteDb();
  jest.clearAllMocks();
});

describe('uploadPendingBlobs', () => {
  it('saves a recording as Upload Pending and lists it with its request', async () => {
    await save('k1');

    const [entry] = await listUploadPendingEntries('proj1');
    expect(entry).toMatchObject({
      key: 'k1',
      projectId: 'proj1',
      retryCount: 0,
      request: request(),
    });
    expect(entry.file.name).toBe('take.webm');
    expect(await entry.file.text()).toBe('k1');
  });

  it('lists only the given project, oldest first', async () => {
    await putLocalMediaBlob({
      clientTempId: 'late',
      projectId: 'proj1',
      status: 'uploadPending',
      blob: file(),
      createdAt: 200,
      uploadRequest: request(),
    });
    await putLocalMediaBlob({
      clientTempId: 'early',
      projectId: 'proj1',
      status: 'uploadPending',
      blob: file(),
      createdAt: 100,
      uploadRequest: request(),
    });
    await saveUploadPendingBlob({
      key: 'other',
      projectId: 'proj2',
      file: file(),
      request: request(),
    });

    expect((await listUploadPendingEntries('proj1')).map((e) => e.key)).toEqual(
      ['early', 'late']
    );
  });

  it('leaves out, and reports, a blob whose upload request is unusable', async () => {
    await putLocalMediaBlob({
      clientTempId: 'bad',
      projectId: 'proj1',
      status: 'uploadPending',
      blob: file(),
    });

    expect(await listUploadPendingEntries('proj1')).toEqual([]);
    expect(logError).toHaveBeenCalled();
    // The audio itself is kept.
    expect(await getLocalMediaBlob('bad')).toBeDefined();
  });

  it('finds the blob for a recording identity only when a passage scopes it', async () => {
    await save('k1');
    await save('k2', { passageId: '' });

    expect(await findUploadPendingKeyForIdentity('proj1', record())).toBe('k1');
    expect(
      await findUploadPendingKeyForIdentity('proj1', record({ passageId: '' }))
    ).toBeUndefined();
    expect(
      await findUploadPendingKeyForIdentity('proj2', record())
    ).toBeUndefined();
  });

  it('reports whether a passage has an Upload Pending recording', async () => {
    await save('k1', { originalFile: 'any-name.webm' });

    expect(
      await hasUploadPendingForPassage('proj1', {
        planId: 'plan1',
        passageId: 'pass1',
        artifactTypeId: null,
      })
    ).toBe(true);
    expect(
      await hasUploadPendingForPassage('proj1', {
        planId: 'plan1',
        passageId: 'pass2',
      })
    ).toBe(false);
    expect(
      await hasUploadPendingForPassage('proj1', {
        planId: 'plan1',
        passageId: '',
      })
    ).toBe(false);
  });

  it('clears Upload Pending blobs for a passage, honoring filter and in-flight', async () => {
    await save('keep-other', { passageId: 'pass2' });
    await save('drop');
    await save('keep-filter', { originalFile: 'keep.webm' });
    await save('busy');
    claimUploadPending('busy');

    await clearUploadPendingForPassage(
      'proj1',
      { planId: 'plan1', passageId: 'pass1', artifactTypeId: null },
      (r) => r.originalFile !== 'keep.webm'
    );
    releaseUploadPending('busy');

    expect(
      (await listUploadPendingEntries('proj1')).map((e) => e.key).sort()
    ).toEqual(['busy', 'keep-filter', 'keep-other'].sort());
  });

  it('counts a failed attempt and keeps the blob Upload Pending', async () => {
    await save('k1');
    await recordUploadPendingFailure('k1');

    const [entry] = await listUploadPendingEntries('proj1');
    expect(entry.retryCount).toBe(1);
  });

  it('marks Cloud-backed under the mediafile id and keeps the bytes', async () => {
    await save('k1');

    await settleUploadPending({
      key: 'k1',
      mediafileId: '42',
      projectId: 'proj1',
      identity: record(),
    });

    expect(await listUploadPendingEntries('proj1')).toEqual([]);
    const kept = await getLocalMediaBlob('42');
    expect(kept).toMatchObject({ status: 'cloudBacked', clientTempId: 'k1' });
    expect(await kept?.blob.text()).toBe('k1');
  });

  it('removes earlier Upload Pending attempts of the same passage recording', async () => {
    await save('old');
    await save('k1');
    await save('other-take', { originalFile: 'other.webm' });

    await settleUploadPending({
      key: 'k1',
      mediafileId: '42',
      projectId: 'proj1',
      identity: record(),
    });

    expect((await listUploadPendingEntries('proj1')).map((e) => e.key)).toEqual(
      ['other-take']
    );
  });

  it('keeps same-named Upload Pending blobs that no passage scopes', async () => {
    await save('old', { passageId: '' });
    await save('k1', { passageId: '' });

    await settleUploadPending({
      key: 'k1',
      mediafileId: '42',
      projectId: 'proj1',
      identity: record({ passageId: '' }),
    });

    expect((await listUploadPendingEntries('proj1')).map((e) => e.key)).toEqual(
      ['old']
    );
    expect(await listLocalMediaBlobsByProject('proj1')).toHaveLength(2);
  });

  it('does not remove an earlier attempt that is uploading right now', async () => {
    await save('old');
    await save('k1');
    claimUploadPending('old');

    await settleUploadPending({
      key: 'k1',
      mediafileId: '42',
      projectId: 'proj1',
      identity: record(),
    });
    releaseUploadPending('old');

    expect((await listUploadPendingEntries('proj1')).map((e) => e.key)).toEqual(
      ['old']
    );
  });
});

describe('Upload Pending claims', () => {
  it('lets one upload hold a key at a time', () => {
    expect(claimUploadPending('k')).toBe(true);
    expect(claimUploadPending('k')).toBe(false);
    expect(isUploadPendingInFlight('k')).toBe(true);
    releaseUploadPending('k');
    expect(isUploadPendingInFlight('k')).toBe(false);
    expect(claimUploadPending('k')).toBe(true);
    releaseUploadPending('k');
  });
});

describe('isUploadPendingRequest', () => {
  it('accepts a request with or without restore links', () => {
    expect(isUploadPendingRequest(request())).toBe(true);
    expect(
      isUploadPendingRequest({
        ...request(),
        restore: { kind: 'title', sectionId: 's1' },
      })
    ).toBe(true);
  });

  it.each([
    ['nothing', undefined],
    ['an unknown upload type', { ...request(), uploadType: 99 }],
    ['no record', { uploadType: UploadType.Media }],
    ['a record without a file name', { ...request(), record: { planId: 'p' } }],
    ['a restore without a kind', { ...request(), restore: {} }],
  ])('rejects %s', (_label, value) => {
    expect(isUploadPendingRequest(value)).toBe(false);
  });
});

describe('discardUploadPendingForProject (ADR 0017 / step 05)', () => {
  it('deletes Upload Pending for the project and keeps Cloud-backed', async () => {
    await save('pending-a');
    await putLocalMediaBlob({
      mediafileId: 'cloud-a',
      projectId: 'proj1',
      status: 'cloudBacked',
      blob: file('cloud'),
      contentType: 'audio/webm',
    });
    await saveUploadPendingBlob({
      key: 'pending-b',
      projectId: 'proj2',
      file: file('b'),
      request: request(),
    });

    const deleted = await discardUploadPendingForProject('proj1');

    expect(deleted).toBe(1);
    expect(await listUploadPendingEntries('proj1')).toEqual([]);
    expect(await getLocalMediaBlob('cloud-a')).toMatchObject({
      status: 'cloudBacked',
    });
    expect(await listUploadPendingEntries('proj2')).toHaveLength(1);
  });

  it('notifies subscribers when Upload Pending is discarded', async () => {
    await save('pending-a');
    const onChange = jest.fn();
    const unsubscribe = subscribeUploadPendingBlobs(onChange);

    await discardUploadPendingForProject('proj1');

    expect(onChange).toHaveBeenCalled();
    unsubscribe();
  });

  it('discards a single Upload Pending blob after confirm', async () => {
    await save('only');
    expect(await discardUploadPendingBlob('only')).toBe(true);
    expect(await listUploadPendingEntries('proj1')).toEqual([]);
  });
});

describe('listUploadPendingEntriesForProjects', () => {
  it('lists Upload Pending in the given projects, oldest first', async () => {
    await saveUploadPendingBlob({
      key: 'later',
      projectId: 'proj2',
      file: file('later'),
      request: request({ originalFile: 'later.webm' }),
    });
    // Force an older createdAt on the second save by writing directly.
    await putLocalMediaBlob({
      clientTempId: 'earlier',
      projectId: 'proj1',
      status: 'uploadPending',
      blob: file('earlier'),
      contentType: 'audio/webm',
      createdAt: 1,
      uploadRequest: request({ originalFile: 'earlier.webm' }),
    });

    await saveUploadPendingBlob({
      key: 'otherUser',
      projectId: 'proj3',
      file: file('otherUser'),
      request: request({ originalFile: 'otherUser.webm' }),
    });

    const mine = new Set(['proj1', 'proj2']);
    const all = await listUploadPendingEntriesForProjects(mine);
    expect(all.map((e) => e.key)).toEqual(['earlier', 'later']);
    expect(await uploadPendingBlobCountForProjects(mine)).toBe(2);
  });
});
