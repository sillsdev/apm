jest.mock('../utils/evictMediaCache', () => ({
  evictMediaCache: jest.fn(() => Promise.resolve()),
}));

jest.mock('../utils/logErrorService', () => ({
  logError: jest.fn(),
  Severity: { error: 'error' },
}));

import MemorySource from '@orbit/memory';
import { RecordKeyMap } from '@orbit/records';
import { UploadType } from '../components/UploadType';
import type { MediaFileD } from '../model';
import { schema } from '../schema';
import {
  appendPendingMediaUpload,
  loadPendingMediaUploads,
  type PendingUploadMediaRecord,
} from '../store/upload/pendingMediaUploads';
import { evictMediaCache } from '../utils/evictMediaCache';
import { logError, Severity } from '../utils/logErrorService';
import {
  isAutosaveFileName,
  removeAllAutosaves,
  removeOldAutosaves,
} from './autosaveMedia';

interface Version {
  id: string;
  version: number;
  file?: string;
  audioUrl?: string;
  remoteId?: string;
  passage?: string;
  artifactType?: string;
}

/** A store holding these versions, which are autosaves unless given a file. */
const seed = async (...versions: Version[]) => {
  const memory = new MemorySource({ schema, keyMap: new RecordKeyMap() });
  await memory.update((t) =>
    versions.map((v) =>
      t.addRecord({
        type: 'mediafile',
        id: v.id,
        ...(v.remoteId && { keys: { remoteId: v.remoteId } }),
        attributes: {
          versionNumber: v.version,
          originalFile: v.file ?? 'base_autosave.wav',
          ...(v.audioUrl && { audioUrl: v.audioUrl }),
        },
        relationships: {
          passage: { data: { type: 'passage', id: v.passage ?? 'p1' } },
          ...(v.artifactType && {
            artifactType: {
              data: { type: 'artifacttype', id: v.artifactType },
            },
          }),
        },
      })
    )
  );
  return memory;
};

const props = (memory: MemorySource, offline = false) => ({
  memory,
  passageId: 'p1',
  planId: 'plan1',
  offline,
  reporter: 'error.log',
});

const storedIds = (memory: MemorySource) =>
  (memory.cache.query((q) => q.findRecords('mediafile')) as MediaFileD[])
    .map((m) => m.id)
    .sort();

const stagePending = (originalFile: string, passageId = 'p1') =>
  appendPendingMediaUpload({
    localAbsolutePath: `/media/${originalFile}`,
    fileSize: 1,
    uploadType: UploadType.Media,
    record: {
      planId: 'plan1',
      passageId,
      originalFile,
    } as PendingUploadMediaRecord,
  });

describe('autosaveMedia', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it.each([
    [undefined, false],
    [null, false],
    ['', false],
    ['base.wav', false],
    ['base_autosave.wav', true],
  ])('isAutosaveFileName(%p) is %p', (name, expected) => {
    expect(isAutosaveFileName(name)).toBe(expected);
  });

  it('removeOldAutosaves keeps the newest autosave and permanent versions', async () => {
    const memory = await seed(
      { id: 'auto2', version: 2 },
      { id: 'auto3', version: 3 },
      { id: 'perm4', version: 4, file: 'base.wav' },
      { id: 'auto1', version: 1 }
    );

    await removeOldAutosaves(props(memory));

    expect(storedIds(memory)).toEqual(['auto3', 'perm4']);
  });

  it('removeAllAutosaves keeps only the permanent versions', async () => {
    const memory = await seed(
      { id: 'auto1', version: 1 },
      { id: 'perm2', version: 2, file: 'base.wav' },
      { id: 'auto3', version: 3 }
    );

    await removeAllAutosaves(props(memory));

    expect(storedIds(memory)).toEqual(['perm2']);
  });

  it('leaves other passages and non-vernacular media', async () => {
    const memory = await seed(
      { id: 'otherPassage', version: 1, passage: 'p2' },
      { id: 'resource', version: 1, artifactType: 'backtranslation' }
    );

    await removeAllAutosaves(props(memory));

    expect(storedIds(memory)).toEqual(['otherPassage', 'resource']);
  });

  it('under Work Offline leaves the autosaves already on the server', async () => {
    const memory = await seed(
      { id: 'server', version: 2, remoteId: '101' },
      { id: 'local', version: 1 }
    );

    await removeAllAutosaves(props(memory, true));

    expect(storedIds(memory)).toEqual(['server']);
  });

  it('outside Work Offline removes the autosaves already on the server', async () => {
    const memory = await seed({ id: 'server', version: 1, remoteId: '101' });

    await removeAllAutosaves(props(memory));

    expect(storedIds(memory)).toEqual([]);
  });

  it("clears the passage's pending autosave uploads", async () => {
    stagePending('base_autosave.wav');
    stagePending('base.wav');
    stagePending('other_autosave.wav', 'p2');

    await removeOldAutosaves(props(await seed()));

    expect(loadPendingMediaUploads().map((p) => p.record.originalFile)).toEqual(
      ['base.wav', 'other_autosave.wav']
    );
  });
});
