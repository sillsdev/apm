import { ISheet, IwsKind, SheetLevel } from '../../model';
import { PassageD } from '../../model';
import { PassageTypeEnum } from '../../model/passageType';
import {
  applySheetCellChanges,
  isValidSheetNumber,
} from './applySheetCellChanges';

const NOW = '2020-06-01T00:00:00.000Z';

const row = (overrides: Partial<ISheet> = {}): ISheet =>
  ({
    level: SheetLevel.Passage,
    kind: IwsKind.Passage,
    sectionSeq: 1,
    passageSeq: 1,
    book: 'LUK',
    reference: '1:1',
    comment: 'keep',
    deleted: false,
    filtered: false,
    passageType: PassageTypeEnum.PASSAGE,
    published: [],
    sectionUpdated: 'old-section',
    passageUpdated: 'old-passage',
    ...overrides,
  }) as ISheet;

const colNames = [
  'sectionSeq',
  'title',
  'passageSeq',
  'book',
  'reference',
  'comment',
];

const apply = (
  sheet: ISheet[],
  changes: { row: number; col: number; value: string | null }[]
) =>
  applySheetCellChanges({
    sheet,
    changes,
    colNames,
    sectionNumCol: 0,
    passageNumCol: 2,
    flat: false,
    findBook: (val) => (val === 'Luke' ? 'LUK' : val),
    now: () => NOW,
  });

describe('isValidSheetNumber', () => {
  it('accepts integers and decimals and rejects other text', () => {
    expect(isValidSheetNumber('12')).toBe(true);
    expect(isValidSheetNumber('-1.5')).toBe(true);
    expect(isValidSheetNumber('')).toBe(false);
    expect(isValidSheetNumber('2a')).toBe(false);
  });
});

describe('applySheetCellChanges', () => {
  it('rejects a non-numeric sequence and leaves the row unchanged', () => {
    const sheet = [row({ sectionSeq: 4 })];
    const result = apply(sheet, [{ row: 0, col: 0, value: 'abc' }]);
    expect(result.invalidNumberCount).toBe(1);
    expect(result.sheet[0].sectionSeq).toBe(4);
    expect(result.sheet[0].sectionUpdated).toBe('old-section');
  });

  it('looks up a book and stamps the passage only', () => {
    const result = apply(
      [row({ book: '' })],
      [{ row: 0, col: 3, value: 'Luke' }]
    );
    expect(result.invalidNumberCount).toBe(0);
    expect(result.sheet[0].book).toBe('LUK');
    expect(result.sheet[0].passageUpdated).toBe(NOW);
    expect(result.sheet[0].sectionUpdated).toBe('old-section');
    expect(result.sheet[0].passageType).toBe(PassageTypeEnum.PASSAGE);
  });

  it('updates passage type and passage when the reference changes', () => {
    const passage = {
      type: 'passage',
      id: 'p1',
      attributes: { reference: '1:1' },
    } as PassageD;
    const result = apply(
      [row({ passage, reference: '1:1' })],
      [{ row: 0, col: 4, value: 'NOTE 1' }]
    );
    expect(result.sheet[0].reference).toBe('NOTE 1');
    expect(result.sheet[0].passageType).toBe(PassageTypeEnum.NOTE);
    expect(result.sheet[0].passage?.attributes.reference).toBe('NOTE 1');
    expect(result.sheet[0].passageUpdated).toBe(NOW);
    expect(result.sheet[0].sectionUpdated).toBe('old-section');
  });

  it('stamps sectionUpdated only for a section column', () => {
    const result = apply(
      [row({ comment: 'keep' })],
      [{ row: 0, col: 1, value: 'Birth' }]
    );
    expect(result.sheet[0].title).toBe('Birth');
    expect(result.sheet[0].sectionUpdated).toBe(NOW);
    expect(result.sheet[0].passageUpdated).toBe('old-passage');
  });

  it('parses a sequence number and leaves an unchanged cell alone', () => {
    const sheet = [row({ sectionSeq: 2, comment: 'same' })];
    const result = apply(sheet, [
      { row: 0, col: 0, value: '3' },
      { row: 0, col: 5, value: 'same' },
    ]);
    expect(result.sheet[0].sectionSeq).toBe(3);
    expect(result.sheet[0].comment).toBe('same');
    expect(result.sheet[0].sectionUpdated).toBe(NOW);
  });
});
