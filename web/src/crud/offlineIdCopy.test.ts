import Memory from '@orbit/memory';
import {
  RecordSchema,
  RecordTransformBuilder,
  type InitializedRecord,
} from '@orbit/records';
import { localCopyRemoval, offlineIdOf } from './offlineIdCopy';

const schema = new RecordSchema({
  models: {
    mediafile: { attributes: { offlineId: { type: 'string' } } },
  },
});

const mediafile = (id: string, offlineId?: string): InitializedRecord => ({
  type: 'mediafile',
  id,
  ...(offlineId === undefined ? {} : { attributes: { offlineId } }),
});

const memoryWith = async (records: InitializedRecord[]) => {
  const memory = new Memory({ schema });
  await memory.sync((t) => records.map((r) => t.addRecord(r)));
  return memory;
};

describe('offlineIdOf', () => {
  it('reads the offline id', () => {
    expect(offlineIdOf(mediafile('s1', 'k1'))).toBe('k1');
  });

  it('is undefined when the record has none, or it is empty', () => {
    expect(offlineIdOf(mediafile('s1'))).toBeUndefined();
    expect(offlineIdOf(mediafile('s1', ''))).toBeUndefined();
    expect(offlineIdOf(undefined)).toBeUndefined();
  });
});

describe('localCopyRemoval', () => {
  const tb = new RecordTransformBuilder();

  it('removes the local record named by the offline id', async () => {
    const memory = await memoryWith([mediafile('k1')]);
    expect(localCopyRemoval(memory, mediafile('s1', 'k1'), tb)).toEqual(
      expect.objectContaining({
        op: 'removeRecord',
        record: { type: 'mediafile', id: 'k1' },
      })
    );
  });

  it('does nothing when that local record is already gone', async () => {
    const memory = await memoryWith([]);
    expect(localCopyRemoval(memory, mediafile('s1', 'k1'), tb)).toBeUndefined();
  });

  it('does nothing for a record with no offline id', async () => {
    const memory = await memoryWith([mediafile('k1')]);
    expect(localCopyRemoval(memory, mediafile('s1'), tb)).toBeUndefined();
  });

  it('never removes the server record itself', async () => {
    const memory = await memoryWith([mediafile('k1', 'k1')]);
    expect(localCopyRemoval(memory, mediafile('k1', 'k1'), tb)).toBeUndefined();
  });
});
