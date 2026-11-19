import {
  RecordKeyMap,
  type InitializedRecord,
  type RecordOperation,
  type RecordTransform,
} from '@orbit/records';
import type Memory from '@orbit/memory';
import {
  isLocalOnlyMediafile,
  linkLocalOnlyMediafile,
  resolveMediafileIdForServer,
  splitLocalOnlyOps,
} from './localOnlyMedia';

const media = (id: string, audioUrl: string): InitializedRecord => ({
  type: 'mediafile',
  id,
  attributes: { audioUrl },
});

const setup = (records: InitializedRecord[] = []) => {
  const keyMap = new RecordKeyMap();
  const byId = new Map(records.map((r) => [`${r.type}:${r.id}`, r]));
  const sync = jest.fn().mockResolvedValue(undefined);
  const memory = {
    keyMap,
    cache: {
      getRecordSync: ({ type, id }: { type: string; id: string }) =>
        byId.get(`${type}:${id}`),
    },
    sync,
  } as unknown as Memory;
  return { memory, keyMap, sync };
};

const tx = (operations: RecordOperation[]): RecordTransform => ({
  id: 'tx1',
  operations,
  options: {},
});

describe('isLocalOnlyMediafile', () => {
  it('is true for a local-media record with no server id', () => {
    const { memory } = setup([media('k1', 'local-media:k1')]);
    expect(isLocalOnlyMediafile(memory, 'k1')).toBe(true);
  });

  it('is false once the record has a server id', () => {
    const { memory, keyMap } = setup([media('k1', 'local-media:k1')]);
    keyMap.pushRecord({ type: 'mediafile', id: 'k1', keys: { remoteId: '9' } });
    expect(isLocalOnlyMediafile(memory, 'k1')).toBe(false);
  });

  it('is false for a normal cloud mediafile', () => {
    const { memory } = setup([media('m1', 'https://s3/x.ogg')]);
    expect(isLocalOnlyMediafile(memory, 'm1')).toBe(false);
  });
});

describe('splitLocalOnlyOps', () => {
  it('keeps the create transform of a local-only take off the server', () => {
    const { memory } = setup();
    const add = {
      op: 'addRecord',
      record: media('k1', 'local-media:k1'),
    } as RecordOperation;
    const link = {
      op: 'replaceRelatedRecord',
      record: { type: 'mediafile', id: 'k1' },
      relationship: 'passage',
      relatedRecord: { type: 'passage', id: 'p1' },
    } as RecordOperation;

    expect(splitLocalOnlyOps(memory, tx([add, link])).toSend).toBeUndefined();
  });

  it('sends a normal transform unchanged', () => {
    const { memory } = setup([media('m1', 'https://s3/x.ogg')]);
    const t = tx([
      {
        op: 'replaceAttribute',
        record: { type: 'mediafile', id: 'm1' },
        attribute: 'transcription',
        value: 'x',
      } as RecordOperation,
    ]);
    expect(splitLocalOnlyOps(memory, t).toSend).toBe(t);
  });

  it('strips only the local-only ops and keeps the transform id', () => {
    const { memory } = setup([media('k1', 'local-media:k1')]);
    const passageOp = {
      op: 'replaceAttribute',
      record: { type: 'passage', id: 'p1' },
      attribute: 'state',
      value: 'x',
    } as RecordOperation;
    const { toSend } = splitLocalOnlyOps(
      memory,
      tx([
        {
          op: 'replaceAttribute',
          record: { type: 'mediafile', id: 'k1' },
          attribute: 'segments',
          value: '{}',
        } as RecordOperation,
        passageOp,
      ])
    );
    expect(toSend?.id).toBe('tx1');
    expect(toSend?.operations).toEqual([passageOp]);
  });

  it('reports removed local-only takes so their blobs are discarded', () => {
    const { memory } = setup([media('k1', 'local-media:k1')]);
    const split = splitLocalOnlyOps(
      memory,
      tx([
        {
          op: 'removeRecord',
          record: { type: 'mediafile', id: 'k1' },
        } as RecordOperation,
      ])
    );
    expect(split.toSend).toBeUndefined();
    expect(split.removedLocalOnly).toEqual(['k1']);
  });

  it('holds back links from other records to a local-only take', () => {
    const { memory } = setup([media('k1', 'local-media:k1')]);
    const link = {
      op: 'replaceRelatedRecord',
      record: { type: 'sectionresource', id: 's1' },
      relationship: 'mediafile',
      relatedRecord: { type: 'mediafile', id: 'k1' },
    } as RecordOperation;
    const split = splitLocalOnlyOps(memory, tx([link]));
    expect(split.toSend).toBeUndefined();
    expect(split.droppedLinks).toEqual([link]);
  });
});

describe('linkLocalOnlyMediafile', () => {
  it('maps the server id onto the local record', async () => {
    const { memory, keyMap } = setup([media('k1', 'local-media:k1')]);
    await linkLocalOnlyMediafile(memory, 'k1', '123');
    expect(keyMap.keyToId('mediafile', 'remoteId', '123')).toBe('k1');
    expect(keyMap.idToKey('mediafile', 'remoteId', 'k1')).toBe('123');
  });

  it('drops a duplicate a sync pulled in first, keeping the local id', async () => {
    const { memory, keyMap, sync } = setup([
      media('k1', 'local-media:k1'),
      media('dup', 'https://s3/x.ogg'),
    ]);
    keyMap.pushRecord({
      type: 'mediafile',
      id: 'dup',
      keys: { remoteId: '123' },
    });
    await linkLocalOnlyMediafile(memory, 'k1', '123');
    expect(sync).toHaveBeenCalledTimes(2);
    expect(keyMap.keyToId('mediafile', 'remoteId', '123')).toBe('k1');
  });
});

describe('resolveMediafileIdForServer', () => {
  it('passes server ids through', () => {
    const { memory } = setup();
    expect(resolveMediafileIdForServer(memory, '42')).toBe('42');
  });

  it('maps an uploaded local take to its server id', () => {
    const { memory, keyMap } = setup([media('k1', 'local-media:k1')]);
    keyMap.pushRecord({ type: 'mediafile', id: 'k1', keys: { remoteId: '7' } });
    expect(resolveMediafileIdForServer(memory, 'k1')).toBe('7');
  });

  it('returns undefined while the source take is still local-only', () => {
    const { memory } = setup([media('k1', 'local-media:k1')]);
    expect(resolveMediafileIdForServer(memory, 'k1')).toBeUndefined();
  });
});
