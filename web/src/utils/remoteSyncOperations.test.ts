import { remoteSyncOperations } from './remoteSyncOperations';

const passage = { type: 'passage', id: 'p1' };
const mediafile = { type: 'mediafile', id: 'm1' };
const user = { type: 'user', id: 'u1' };

const updateTask = (...operations: object[]) => ({
  type: 'update',
  data: { operations },
});

const transcriptionSave = updateTask(
  { op: 'updateRecord', record: { ...mediafile, attributes: {} } },
  { op: 'addRecord', record: { type: 'passagestatechange', id: 'psc1' } }
);

const stepCompleteWrite = (value: string) =>
  updateTask({
    op: 'replaceAttribute',
    record: passage,
    attribute: 'stepComplete',
    value,
  });

const passageDiff = (value: string) => ({
  op: 'replaceAttribute',
  record: passage,
  attribute: 'stepComplete',
  value,
});

describe('remoteSyncOperations', () => {
  describe('included records', () => {
    it('drops included records the update did not touch (TT-7800 Submit)', () => {
      const included = [
        {
          op: 'updateRecord',
          record: { ...passage, attributes: { stepComplete: '{}' } },
        },
        { op: 'updateRecord', record: { ...user, attributes: {} } },
      ];
      expect(remoteSyncOperations(included, [transcriptionSave])).toEqual([]);
    });

    it('keeps updateRecord ops for records the update itself wrote', () => {
      const ops = [
        { op: 'updateRecord', record: { ...mediafile, attributes: {} } },
        { op: 'updateRecord', record: { ...passage, attributes: {} } },
      ];
      expect(remoteSyncOperations(ops, [transcriptionSave])).toEqual([ops[0]]);
    });

    it('drops every updateRecord when the update has no operations', () => {
      const ops = [{ op: 'updateRecord', record: { ...user, attributes: {} } }];
      expect(remoteSyncOperations(ops, [{ type: 'update' }])).toEqual([]);
    });
  });

  describe('records a later queued update rewrites', () => {
    it('drops a stale passage diff while a later passage write is queued (Reopen)', () => {
      // Reopen: current=false is answered while next=false is still queued.
      const ops = [passageDiff('current=false,next=true')];
      const queue = [
        stepCompleteWrite('current=false'),
        stepCompleteWrite('current=false,next=false'),
      ];
      expect(remoteSyncOperations(ops, queue)).toEqual([]);
    });

    it('drops a passage included in this write’s state-change response when a later write is queued', () => {
      // persist sends the passage and a passagestatechange in one task, so the
      // included passage counts as "own"; a later queued passage write must
      // still win over it.
      const persist = updateTask(passageDiff('current=false'), {
        op: 'addRecord',
        record: { type: 'passagestatechange', id: 'psc2' },
      });
      const includedPassage = {
        op: 'updateRecord',
        record: { ...passage, attributes: { stepComplete: 'current=false' } },
      };
      const queue = [persist, stepCompleteWrite('current=false,next=false')];
      expect(remoteSyncOperations([includedPassage], queue)).toEqual([]);
      // With nothing queued after it, the same snapshot is current and syncs.
      expect(remoteSyncOperations([includedPassage], [persist])).toEqual([
        includedPassage,
      ]);
    });

    it('keeps the last write once nothing later rewrites it', () => {
      const ops = [passageDiff('current=false,next=false')];
      expect(
        remoteSyncOperations(ops, [
          stepCompleteWrite('current=false,next=false'),
        ])
      ).toEqual(ops);
    });

    it('drops a query result for a record with a queued update', () => {
      const ops = [
        { op: 'updateRecord', record: { ...passage, attributes: {} } },
      ];
      const queue = [
        { type: 'query', data: {} },
        stepCompleteWrite('current=true'),
      ];
      expect(remoteSyncOperations(ops, queue)).toEqual([]);
    });

    it('ignores later queued queries', () => {
      const ops = [passageDiff('x')];
      const queue = [stepCompleteWrite('x'), { type: 'query', data: {} }];
      expect(remoteSyncOperations(ops, queue)).toEqual(ops);
    });

    it('always keeps key assignments and removals', () => {
      const ops = [
        { op: 'replaceKey', record: passage, key: 'remoteId', value: '7' },
        { op: 'removeRecord', record: passage },
      ];
      const queue = [transcriptionSave, stepCompleteWrite('x')];
      expect(remoteSyncOperations(ops, queue)).toEqual(ops);
    });

    it('keeps other records in the same response', () => {
      const mediaDiff = {
        op: 'replaceAttribute',
        record: mediafile,
        attribute: 'transcription',
        value: 'hello',
      };
      const ops = [mediaDiff, passageDiff('stale')];
      const queue = [transcriptionSave, stepCompleteWrite('new')];
      expect(remoteSyncOperations(ops, queue)).toEqual([mediaDiff]);
    });
  });

  describe('no filtering', () => {
    it('leaves a lone query response alone', () => {
      const ops = [
        { op: 'updateRecord', record: { ...passage, attributes: {} } },
      ];
      expect(remoteSyncOperations(ops, [{ type: 'query', data: {} }])).toEqual(
        ops
      );
    });

    it('passes everything through with an empty queue', () => {
      const ops = [passageDiff('x')];
      expect(remoteSyncOperations(ops, [])).toEqual(ops);
    });

    it('returns [] for no operations', () => {
      expect(remoteSyncOperations([], [transcriptionSave])).toEqual([]);
      expect(remoteSyncOperations(undefined, [])).toEqual([]);
    });

    it('accepts a single operation', () => {
      const op = {
        op: 'updateRecord',
        record: { ...mediafile, attributes: {} },
      };
      expect(remoteSyncOperations(op, [transcriptionSave])).toEqual([op]);
    });
  });
});
