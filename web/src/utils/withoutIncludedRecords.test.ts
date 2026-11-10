import { withoutIncludedRecords } from './withoutIncludedRecords';

const passage = { type: 'passage', id: 'p1' };
const mediafile = { type: 'mediafile', id: 'm1' };
const user = { type: 'user', id: 'u1' };

const transcriptionSaveTask = {
  type: 'update',
  data: {
    operations: [
      { op: 'updateRecord', record: { ...mediafile, attributes: {} } },
      { op: 'addRecord', record: { type: 'passagestatechange', id: 'psc1' } },
    ],
  },
};

describe('withoutIncludedRecords', () => {
  it('drops included records the update did not touch (TT-7800)', () => {
    const included = [
      {
        op: 'updateRecord',
        record: { ...passage, attributes: { stepComplete: '{}' } },
      },
      { op: 'updateRecord', record: { ...user, attributes: {} } },
    ];
    expect(withoutIncludedRecords(included, transcriptionSaveTask)).toEqual([]);
  });

  it('keeps updateRecord ops for records the update itself wrote', () => {
    const ops = [
      { op: 'updateRecord', record: { ...mediafile, attributes: {} } },
      { op: 'updateRecord', record: { ...passage, attributes: {} } },
    ];
    expect(withoutIncludedRecords(ops, transcriptionSaveTask)).toEqual([
      ops[0],
    ]);
  });

  it('keeps primary-record diffs and key updates', () => {
    const ops = [
      {
        op: 'replaceAttribute',
        record: passage,
        attribute: 'stepComplete',
        value: '{}',
      },
      { op: 'replaceKey', record: passage, key: 'remoteId', value: '7' },
    ];
    expect(withoutIncludedRecords(ops, transcriptionSaveTask)).toEqual(ops);
  });

  it('leaves query responses alone', () => {
    const ops = [
      { op: 'updateRecord', record: { ...passage, attributes: {} } },
    ];
    expect(withoutIncludedRecords(ops, { type: 'query', data: {} })).toEqual(
      ops
    );
    expect(withoutIncludedRecords(ops, undefined)).toEqual(ops);
  });

  it('accepts a single operation', () => {
    const op = { op: 'updateRecord', record: { ...mediafile, attributes: {} } };
    expect(withoutIncludedRecords(op, transcriptionSaveTask)).toEqual([op]);
  });
});
