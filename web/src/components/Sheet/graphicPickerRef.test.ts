import { ISheet, IwsKind, SheetLevel } from '../../model';
import { PassageD } from '../../model';
import { PassageTypeEnum } from '../../model/passageType';
import { graphicPickerRefString } from './graphicPickerRef';

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

const verses = new Map<string, number[]>([['LUK', [31, 25]]]);

const refFor = (
  overrides: Partial<ISheet>,
  refs: Partial<{
    noteRef: string;
    movementRef: string;
    sectionRef: string;
  }> = {}
) =>
  graphicPickerRefString({
    row: row(overrides),
    flat: false,
    firstBook: 'LUK',
    verseCounts: verses,
    noteRef: refs.noteRef ?? '',
    movementRef: refs.movementRef ?? '',
    sectionRef: refs.sectionRef ?? 'Luke 1:1-4',
  });

describe('graphicPickerRefString', () => {
  it('uses the note reference when the row is a note with a passage', () => {
    const passage = { type: 'passage', id: 'p1', attributes: {} } as PassageD;
    expect(
      refFor(
        { reference: 'NOTE', passage },
        { noteRef: 'Note 2:3-4', sectionRef: 'should-not-use' }
      )
    ).toBe('2:3-4');
  });

  it('falls through to the section reference when a note has no passage', () => {
    expect(refFor({ reference: 'NOTE' }, { noteRef: '2:3-4' })).toBe('1:1-4');
  });

  it('uses a movement reference and falls through when it is empty', () => {
    expect(refFor({ reference: 'MOVE' }, { movementRef: 'Move 4:1-2' })).toBe(
      '4:1-2'
    );
    expect(refFor({ reference: 'MOVE' }, { movementRef: '' })).toBe('1:1-4');
  });

  it('builds a chapter range and uses the 1-999 fallback at the last chapter', () => {
    expect(refFor({ reference: 'CHNUM 1' })).toBe('LUK 1:1-31');
    expect(refFor({ reference: 'CHNUM 2' })).toBe('LUK 2:1-999');
    expect(refFor({ reference: 'CHNUM' })).toBe('LUK 1:1-999');
  });

  it('builds a whole-book range, or the unbounded fallback when verses are missing', () => {
    expect(refFor({ reference: 'BOOK' })).toBe('LUK 1:1-2:25');
    expect(refFor({ reference: 'ALTBK' })).toBe('LUK 1:1-2:25');
    expect(
      graphicPickerRefString({
        row: row({ reference: 'BOOK' }),
        flat: false,
        firstBook: 'LUK',
        verseCounts: new Map(),
        noteRef: '',
        movementRef: '',
        sectionRef: '',
      })
    ).toBe('LUK 1:1-999:999');
  });

  it('returns the section reference tail for an ordinary passage', () => {
    expect(refFor({ reference: '1:1-4' })).toBe('1:1-4');
    expect(
      refFor({ reference: '1:1-4' }, { sectionRef: 'no digits here' })
    ).toBe('no digits here');
  });
});
