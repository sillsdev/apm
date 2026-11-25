import Memory from '@orbit/memory';
import {
  RecordKeyMap,
  RecordSchema,
  type InitializedRecord,
} from '@orbit/records';
import { completePendingUploadRetry } from './completePendingUploadRetry';

// TT-7907: the drain sends the Upload Pending key as the mediafile's offline
// id. When the pull brings the server row in, the local-only record with that
// id gives way to it (the offline-id rule DeleteLocalCopy applies), so only
// one mediafile is left.

const mockPullTableList = jest.fn();
jest.mock('../../crud/pullTableList', () => ({
  pullTableList: (...args: unknown[]) => mockPullTableList(...args),
}));

const schema = new RecordSchema({
  models: {
    mediafile: {
      keys: { remoteId: {} },
      attributes: {
        audioUrl: { type: 'string' },
        offlineId: { type: 'string' },
      },
    },
  },
});

const KEY = 'upk-1';

const localOnlyTake = (): InitializedRecord => ({
  type: 'mediafile',
  id: KEY,
  attributes: { audioUrl: `local-media:${KEY}`, offlineId: '' },
});

const serverRow = (id: string): InitializedRecord => ({
  type: 'mediafile',
  id,
  keys: { remoteId: '42' },
  attributes: { audioUrl: 'https://s3/x.ogg', offlineId: KEY },
});

const setup = async (records: InitializedRecord[]) => {
  const keyMap = new RecordKeyMap();
  const memory = new Memory({ schema, keyMap });
  for (const r of records) keyMap.pushRecord(r);
  await memory.sync((t) => records.map((r) => t.addRecord(r)));
  const backup = { sync: jest.fn().mockResolvedValue(undefined) };
  // The server pull: adds row 42, or updates it in place when the keyMap
  // already maps it (as JSONAPISource does).
  mockPullTableList.mockImplementation(async () => {
    const id = keyMap.keyToId('mediafile', 'remoteId', '42') ?? 'server-guid';
    const rec = serverRow(id);
    keyMap.pushRecord(rec);
    await memory.sync((t) => t.updateRecord(rec));
  });
  return { memory, backup };
};

const complete = (memory: Memory, backup: { sync: jest.Mock }) =>
  completePendingUploadRetry({
    stringId: '42',
    memory,
    remote: {} as never,
    backup: backup as never,
    reporter: {},
    user: 'user-1',
  });

const mediafiles = (memory: Memory) =>
  memory.cache.getRecordsSync('mediafile').map((r) => r.id);

describe('completePendingUploadRetry offline id (TT-7907)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('replaces the local-only take with the server row', async () => {
    const { memory, backup } = await setup([localOnlyTake()]);

    await complete(memory, backup);

    expect(mediafiles(memory)).toEqual(['server-guid']);
  });

  it('leaves one record when a sync pulled the row in before a retry', async () => {
    // The first POST created row 42 but its response was lost; a pull then
    // brought row 42 in beside the local-only take. The retried POST returns
    // the same row.
    const { memory, backup } = await setup([
      localOnlyTake(),
      serverRow('pulled-guid'),
    ]);

    await complete(memory, backup);

    expect(mediafiles(memory)).toEqual(['pulled-guid']);
  });

  it('removes the local copy from the backup too', async () => {
    const { memory, backup } = await setup([localOnlyTake()]);

    await complete(memory, backup);

    expect(backup.sync).toHaveBeenCalledTimes(1);
  });

  it('keeps a row whose offline id names no local record', async () => {
    const { memory, backup } = await setup([]);

    await complete(memory, backup);

    expect(mediafiles(memory)).toEqual(['server-guid']);
    expect(backup.sync).not.toHaveBeenCalled();
  });
});
