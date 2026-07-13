import { RecordSchema } from '@orbit/records';
import MemorySource from '@orbit/memory';
import IndexedDBSource from '@orbit/indexeddb';
import { backupToMemory } from './syncToMemory';

const schema = new RecordSchema({
  models: {
    mediafile: {
      attributes: {
        originalFile: { type: 'string' },
        transcription: { type: 'string' },
      },
    },
  },
});

describe('backupToMemory', () => {
  it('updates an existing memory record instead of throwing', async () => {
    const memory = new MemorySource({ schema });
    await memory.update((t) =>
      t.addRecord({
        type: 'mediafile',
        id: 'm1',
        attributes: { originalFile: 'a.wav', transcription: 'old' },
      })
    );

    const backup = {
      query: jest.fn().mockResolvedValue([
        {
          type: 'mediafile',
          id: 'm1',
          attributes: { originalFile: 'a.wav', transcription: 'from-backup' },
        },
      ]),
    } as unknown as IndexedDBSource;

    await expect(
      backupToMemory({ backup, table: 'mediafile', memory })
    ).resolves.toBeUndefined();

    const rec = memory.cache.getRecordSync({
      type: 'mediafile',
      id: 'm1',
    }) as unknown as { attributes: { transcription: string } };
    expect(rec.attributes.transcription).toBe('from-backup');
  });
});
