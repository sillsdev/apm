import { ISheet, IwsKind, SheetLevel } from '../../model';
import { PassageTypeEnum } from '../../model/passageType';
import {
  findSection,
  getByIndex,
  getUndelIndex,
  lastPassageRowBelow,
  sectionRowAbove,
  sheetFirstBook,
} from './sheetRowIndex';

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
    ...overrides,
  });

describe('getByIndex', () => {
  it('returns undefined for an empty sheet', () => {
    expect(getByIndex([], 0)).toEqual({ ws: undefined, i: 0 });
  });

  it('skips deleted and filtered rows', () => {
    const visible = row({ reference: 'visible' });
    const sheet = [
      row({ deleted: true, reference: 'gone' }),
      visible,
      row({ filtered: true, reference: 'hidden' }),
      row({ reference: 'next' }),
    ];
    expect(getByIndex(sheet, 0)).toEqual({ ws: visible, i: 1 });
    expect(getByIndex(sheet, 1).ws?.reference).toBe('next');
    expect(getByIndex(sheet, 2)).toEqual({ ws: undefined, i: 4 });
  });
});

describe('getUndelIndex', () => {
  it('returns undefined when no visible index is given', () => {
    expect(getUndelIndex([section(1)], undefined)).toBeUndefined();
  });

  it('maps a visible index onto the sheet index', () => {
    const sheet = [row({ deleted: true }), section(1), row()];
    expect(getUndelIndex(sheet, 1)).toBe(2);
  });
});

describe('findSection', () => {
  const sheet = [
    section(1),
    row({ reference: 'a' }),
    section(2, {
      level: SheetLevel.Movement,
      passageType: PassageTypeEnum.MOVEMENT,
      reference: 'MOVE',
    }),
    row({ reference: 'b' }),
    section(3),
  ];

  it('walks backward to the previous section row', () => {
    expect(findSection(sheet, 3, true, false)).toBe(2);
  });

  it('walks forward to the next section row', () => {
    expect(findSection(sheet, 1, false, false)).toBe(2);
  });

  it('returns -1 when the walk falls off either end', () => {
    expect(findSection(sheet, 0, true, false)).toBe(0);
    expect(findSection([row()], 0, true, false)).toBe(-1);
    expect(findSection([row()], 0, false, false)).toBe(-1);
  });

  it('skips publishing rows that are not level Section', () => {
    expect(findSection(sheet, 3, true, true)).toBe(0);
  });
});

describe('sheetFirstBook', () => {
  it('returns empty when every row is deleted or blank', () => {
    expect(sheetFirstBook([])).toBe('');
    expect(
      sheetFirstBook([row({ deleted: true, book: 'JHN' }), row({ book: '' })])
    ).toBe('');
  });

  it('returns the first kept book', () => {
    expect(
      sheetFirstBook([
        row({ deleted: true, book: 'MAT' }),
        row({ book: 'LUK' }),
      ])
    ).toBe('LUK');
  });
});

describe('section row walks', () => {
  it('stops on the section above the start row', () => {
    const isSection = (i: number) => i === 0;
    expect(sectionRowAbove(2, isSection)).toBe(0);
  });

  it('stops on the last passage below the start row', () => {
    const isPassage = (i: number) => i > 0 && i < 4;
    expect(lastPassageRowBelow(1, isPassage)).toBe(3);
  });

  it('stays put when the next row is not a passage', () => {
    expect(lastPassageRowBelow(0, () => false)).toBe(0);
  });
});
