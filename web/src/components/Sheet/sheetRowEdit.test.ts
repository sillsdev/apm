import { IMediaShare, ISheet, IwsKind, SheetLevel } from '../../model';
import { PassageTypeEnum } from '../../model/passageType';
import {
  addPassageTo,
  insertAt,
  movePassageTo,
  movePassageToNextSection,
  moveSectionTo,
  newSection,
  nextSecSequence,
  updateRowAt,
} from './sheetRowEdit';

const NOW = '2020-06-01T00:00:00.000Z';
const now = () => NOW;

const row = (overrides: Partial<ISheet> = {}): ISheet =>
  ({
    level: SheetLevel.Passage,
    kind: IwsKind.Passage,
    sectionSeq: 1,
    passageSeq: 1,
    book: 'LUK',
    reference: '1:1',
    deleted: false,
    filtered: false,
    passageType: PassageTypeEnum.PASSAGE,
    published: [],
    ...overrides,
  }) as ISheet;

const section = (seq: number, overrides: Partial<ISheet> = {}) =>
  row({
    level: SheetLevel.Section,
    kind: IwsKind.Section,
    sectionSeq: seq,
    passageSeq: 0,
    reference: '',
    passageType: PassageTypeEnum.PASSAGE,
    ...overrides,
  });

const refs = (sheet: ISheet[]) => sheet.map((r) => r.reference);

describe('insertAt', () => {
  it('appends when no index is given', () => {
    const arr = [row({ reference: 'a' })];
    const item = row({ reference: 'b' });
    expect(refs(insertAt(arr, item))).toEqual(['a', 'b']);
    expect(arr).toHaveLength(1);
  });

  it('inserts at an index and drops the last element of the input', () => {
    const arr = [
      row({ reference: 'a' }),
      row({ reference: 'b' }),
      row({ reference: 'c' }),
    ];
    const item = row({ reference: 'x' });
    expect(refs(insertAt(arr, item, 1))).toEqual(['a', 'x', 'b', 'c']);
    expect(refs(arr)).toEqual(['a', 'b']);
  });
});

describe('updateRowAt', () => {
  it('replaces one row and leaves the input array in place', () => {
    const arr = [row({ reference: 'a' }), row({ reference: 'b' })];
    const next = updateRowAt(arr, row({ reference: 'z' }), 0);
    expect(refs(next)).toEqual(['z', 'b']);
    expect(refs(arr)).toEqual(['a', 'b']);
  });
});

describe('nextSecSequence', () => {
  it('starts at 1 for an empty sheet', () => {
    expect(nextSecSequence([])).toBe(1);
  });

  it('ignores deleted rows and rows at or after the insert index', () => {
    const sheet = [section(1), section(5, { deleted: true }), section(9)];
    expect(nextSecSequence(sheet)).toBe(10);
    expect(nextSecSequence(sheet, 1)).toBe(2);
    expect(nextSecSequence(sheet, undefined, PassageTypeEnum.MOVEMENT)).toBe(
      9.01
    );
  });
});

describe('newSection', () => {
  const ctx = {
    flat: false,
    scripture: true,
    firstBook: 'LUK',
    shared: false,
    now,
  };

  it('numbers a section at the end of the sheet', () => {
    const created = newSection({
      ...ctx,
      level: SheetLevel.Section,
      sheet: [section(2)],
    });
    expect(created.sectionSeq).toBe(3);
    expect(created.kind).toBe(IwsKind.Section);
    expect(created.book).toBe('LUK');
    expect(created.sectionUpdated).toBe(NOW);
    expect(created.rowKey).toEqual(expect.any(String));
    expect(created.rowKey?.length).toBeGreaterThan(0);
  });

  it('numbers a section from the rows before a middle index', () => {
    const created = newSection({
      ...ctx,
      level: SheetLevel.Movement,
      sheet: [section(1), section(8)],
      index: 1,
      passageType: PassageTypeEnum.MOVEMENT,
      flat: true,
      scripture: false,
    });
    expect(created.sectionSeq).toBe(1.01);
    expect(created.kind).toBe(IwsKind.SectionPassage);
    expect(created.book).toBe('');
  });
});

describe('movePassageTo', () => {
  it('swaps a passage with the row above and renumbers the section', () => {
    const sheet = [
      section(1),
      row({ reference: 'a', passageSeq: 1 }),
      row({ reference: 'b', passageSeq: 2 }),
    ];
    const next = movePassageTo(sheet, 2, true, false);
    expect(refs(next)).toEqual(['', 'b', 'a']);
    expect(next.map((r) => r.passageSeq)).toEqual([0, 1, 2]);
  });
});

describe('moveSectionTo', () => {
  it('swaps two ordinary sections and writes the new sequences onto the row objects', () => {
    const first = section(1, { reference: 's1' });
    const passage = row({ reference: 'a', sectionSeq: 1 });
    const second = section(2, { reference: 's2' });
    const tail = row({ reference: 'b', sectionSeq: 2 });
    const sheet = [first, passage, second, tail];
    const next = moveSectionTo(sheet, 2, true, now);
    expect(refs(next)).toEqual(['s2', 'b', 's1', 'a']);
    expect(next.map((r) => r.sectionSeq)).toEqual([1, 1, 2, 2]);
    expect(second.sectionSeq).toBe(1);
    expect(second.sectionUpdated).toBe(NOW);
    expect(sheet.map((r) => r.reference)).toEqual(['s1', 'a', 's2', 'b']);
  });

  it('gives a movement a fractional sequence when it swaps with a section', () => {
    const movement = section(1, {
      reference: 'm',
      level: SheetLevel.Movement,
      passageType: PassageTypeEnum.MOVEMENT,
    });
    const under = row({ reference: 'a', sectionSeq: 1 });
    const normal = section(2, { reference: 's' });
    const tail = row({ reference: 'b', sectionSeq: 2 });
    const next = moveSectionTo([movement, under, normal, tail], 2, true, now);
    expect(refs(next)).toEqual(['a', 's', 'b', 'm']);
    expect(movement.sectionSeq).toBe(2.01);
    expect(normal.sectionSeq).toBe(2);
  });
});

describe('movePassageToNextSection', () => {
  const sheet = () => [
    section(1, { reference: 's1' }),
    row({ reference: 'a', sectionSeq: 1, passageSeq: 1 }),
    section(2, { reference: 's2' }),
    row({ reference: 'b', sectionSeq: 2, passageSeq: 1 }),
  ];

  it('moves a passage into the previous section', () => {
    const next = movePassageToNextSection({
      sheet: sheet(),
      index: 3,
      before: true,
      flat: false,
      now,
    });
    expect(refs(next ?? [])).toEqual(['s1', 'a', 'b', 's2']);
    expect(next?.[2].sectionSeq).toBe(1);
  });

  it('moves a passage into the following section', () => {
    const next = movePassageToNextSection({
      sheet: sheet(),
      index: 1,
      before: false,
      flat: false,
      now,
    });
    expect(refs(next ?? [])).toEqual(['s1', 's2', 'a', 'b']);
    expect(next?.[2].sectionSeq).toBe(2);
  });

  it('returns undefined when there is no section on that side', () => {
    const only = [section(1, { reference: 's1' }), row({ reference: 'a' })];
    expect(
      movePassageToNextSection({
        sheet: only,
        index: 1,
        before: true,
        flat: false,
        now,
      })
    ).toBeUndefined();
  });
});

describe('addPassageTo', () => {
  const ctx = {
    flat: false,
    scripture: true,
    firstBook: 'JHN',
    shared: true,
    now,
  };

  it('inserts a passage under a section row', () => {
    const sheet = [section(1, { reference: 's' }), row({ reference: 'a' })];
    const next = addPassageTo({
      ...ctx,
      level: SheetLevel.Passage,
      sheet,
      index: 0,
      passageType: PassageTypeEnum.NOTE,
    });
    expect(refs(next)).toEqual(['s', 'NOTE', 'a']);
    expect(next[1].kind).toBe(IwsKind.Passage);
    expect(next[1].book).toBe('JHN');
    expect(next[1].mediaShared).toBe(IMediaShare.None);
    expect(next[1].passageType).toBe(PassageTypeEnum.NOTE);
    expect(next[1].rowKey).toEqual(expect.any(String));
    expect(next[1].passageSeq).toBe(0.01);
  });

  it('fills an empty flat section row instead of inserting one', () => {
    const sheet = [
      section(1, {
        kind: IwsKind.Section,
        reference: '',
        book: 'LUK',
      }),
    ];
    const next = addPassageTo({
      ...ctx,
      flat: true,
      level: SheetLevel.Section,
      sheet,
      index: 0,
      reference: '1:1-4',
      title: 'Birth',
    });
    expect(next).toHaveLength(1);
    expect(next[0].kind).toBe(IwsKind.SectionPassage);
    expect(next[0].reference).toBe('1:1-4');
    expect(next[0].comment).toBe('Birth');
    expect(next[0].level).toBe(SheetLevel.Section);
    expect(next[0].passage).toBeUndefined();
  });
});
