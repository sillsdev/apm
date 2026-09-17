import {
  ColName,
  rebuildMarkVersesTable,
  type ICell,
} from './markVersesTableReconstruction';
import { RefStatus } from './markVersesSegmentColors';
import { refMatch } from './refMatch';
import { parseMarkVersesReference } from './markVersesPassageVerses';
import { parseRef } from '../crud/passage';
import { IRegion } from '../crud/useWavesurferRegions';
import { Passage, PassageD } from '../model';

/**
 * Spec for the Mark Verses table rebuild — what the user sees in the table after
 * the waveform reports its segments.
 */

const book = 'LUK';
const passage = {
  attributes: { book, reference: '1:1-5' },
} as unknown as PassageD;
const autoRefs = ['1:1', '1:2', '1:3', '1:4', '1:5'];

const widths = [150, 150];
const readOnlys = [true, false];
const cClass = ['lim', 'ref'];

const rowCells = (row: string[], first = false): ICell[] =>
  row.map((value, index) => {
    const isRef = !first && index === ColName.Ref;
    const isBadRef = isRef && Boolean(value) && !refMatch(value);
    return {
      value,
      width: widths[index],
      readOnly: first || readOnlys[index],
      className: first ? 'cTitle' : cClass[index],
      status: isRef
        ? isBadRef
          ? RefStatus.Err
          : RefStatus.Valid
        : undefined,
    } as ICell;
  });

const headerRow = () => rowCells(['Start-Stop', 'Reference'], true);

const formLim = ({ start, end }: IRegion) =>
  `${start.toFixed(1)}-${end.toFixed(1)}`;

const getRefs = (value: string): string[] => {
  const psg = { attributes: { reference: value, book } } as Passage;
  parseRef(psg);
  const { startChapter, startVerse, endVerse } = psg.attributes;
  if (!startChapter || !startVerse) return [];

  const refs: string[] = [];
  for (let verse = Number(startVerse); verse <= Number(endVerse); verse += 1) {
    refs.push(`${startChapter}:${verse}`);
  }

  const parsed = parseMarkVersesReference(value);
  if (parsed && refs.length > 0) {
    const lastIndex = refs.length - 1;
    const startSuffix = parsed.start.verseLetterSuffix;
    const endSuffix = parsed.end.verseLetterSuffix;
    if (lastIndex === 0 && startSuffix && endSuffix && startSuffix !== endSuffix) {
      refs[0] = `${refs[0]}${startSuffix}-${endSuffix}`;
    } else {
      if (startSuffix && lastIndex > 0) refs[0] = `${refs[0]}${startSuffix}`;
      if (endSuffix) {
        refs[lastIndex] =
          lastIndex > 0 && endSuffix !== 'a'
            ? `${refs[lastIndex]}a-${endSuffix}`
            : `${refs[lastIndex]}${endSuffix}`;
      }
    }
  }
  return refs;
};

const collectRefs = (tableData: ICell[][]): string[] => {
  const refs: string[] = [];
  tableData.slice(1).forEach((row) => {
    const value = `${row[ColName.Ref]?.value ?? ''}`;
    if (refMatch(value)) refs.push(...getRefs(value));
  });
  return refs;
};

const table = (rows: [string, string][]): ICell[][] => [
  headerRow(),
  ...rows.map((row) => rowCells(row)),
];

const unmarkedTable = () =>
  table(autoRefs.map((ref) => ['', ref] as [string, string]));

const region = (start: number, end: number, label?: string): IRegion =>
  ({ start, end, label }) as IRegion;

const rows = (data: ICell[][]): [string, string][] =>
  data
    .slice(1)
    .map((row) => [
      `${row[ColName.Limits].value}`,
      `${row[ColName.Ref].value}`,
    ]);

const rebuild = (
  regions: IRegion[],
  previousData: ICell[][],
  init = false
) =>
  rebuildMarkVersesTable({
    regions,
    previousData,
    autoRefs,
    init,
    passage,
    headerRow: headerRow(),
    rowCells,
    collectRefs,
    formLim,
  });

describe('rebuildMarkVersesTable', () => {
  it('converts saved segments into rows and lists the unmarked verses below', () => {
    // Opening the tool on a passage that was partly marked in an earlier
    // session: the saved regions carry their verse labels, and the verses that
    // were never marked still get a row so the user can work through them.
    const { newData, reset } = rebuild(
      [region(0, 2.5, '1:1'), region(2.5, 5, '1:2')],
      unmarkedTable(),
      true
    );

    expect(rows(newData)).toEqual([
      ['0.0-2.5', '1:1'],
      ['2.5-5.0', '1:2'],
      ['', '1:3'],
      ['', '1:4'],
      ['', '1:5'],
    ]);
    // Nothing was re-labeled, so the player's segments do not need re-pushing.
    expect(reset).toBe(false);
    // The header the caller passed in stays row 0.
    expect(newData[0]).toEqual(headerRow());
  });

  it('labels a newly marked segment with the next verse and asks for a re-push', () => {
    // The user marks the first segment on an untouched passage. The region has
    // no label yet, so it takes the first passage verse — and because the
    // region itself was changed, `reset` tells the caller to send the segments
    // back to the waveform so the label shows there too.
    const newRegion = region(0, 2.5);
    const { newData, reset } = rebuild([newRegion], unmarkedTable());

    expect(rows(newData)).toEqual([
      ['0.0-2.5', '1:1'],
      ['', '1:2'],
      ['', '1:3'],
      ['', '1:4'],
      ['', '1:5'],
    ]);
    expect(reset).toBe(true);
    expect(newRegion.label).toBe('1:1');
  });

  it('keeps each row on its verse when the user drags a boundary', () => {
    // Dragging the 1:1/1:2 boundary later only moves the times; the references
    // the user already assigned stay put and nothing needs re-pushing.
    const previous = table([
      ['0.0-2.5', '1:1'],
      ['2.5-5.0', '1:2'],
      ['', '1:3'],
      ['', '1:4'],
      ['', '1:5'],
    ]);

    const { newData, reset } = rebuild(
      [region(0, 3.2, '1:1'), region(3.2, 5, '1:2')],
      previous
    );

    expect(rows(newData)).toEqual([
      ['0.0-3.2', '1:1'],
      ['3.2-5.0', '1:2'],
      ['', '1:3'],
      ['', '1:4'],
      ['', '1:5'],
    ]);
    expect(reset).toBe(false);
  });

  it('gives a segment added at the end the next unmarked verse', () => {
    // Marking continues down the passage: the third region picks up 1:3, the
    // row that was waiting unmarked, and 1:4/1:5 stay in the tail.
    const previous = table([
      ['0.0-2.0', '1:1'],
      ['2.0-4.0', '1:2'],
      ['', '1:3'],
      ['', '1:4'],
      ['', '1:5'],
    ]);

    const { newData } = rebuild(
      [
        region(0, 2, '1:1'),
        region(2, 4, '1:2'),
        region(4, 6), // just marked, not labeled yet
      ],
      previous
    );

    expect(rows(newData)).toEqual([
      ['0.0-2.0', '1:1'],
      ['2.0-4.0', '1:2'],
      ['4.0-6.0', '1:3'],
      ['', '1:4'],
      ['', '1:5'],
    ]);
  });

  it('returns a verse to the unmarked tail when the user deletes its boundary', () => {
    // Three marked rows; the user removes the boundary between 1:2 and 1:3, so
    // the second region now spans both. 1:3 is no longer marked and goes back
    // to waiting at the top of the tail.
    const previous = table([
      ['0.0-2.0', '1:1'],
      ['2.0-4.0', '1:2'],
      ['4.0-6.0', '1:3'],
      ['', '1:4'],
      ['', '1:5'],
    ]);

    const { newData } = rebuild(
      [region(0, 2, '1:1'), region(2, 6, '1:2')],
      previous
    );

    expect(rows(newData)).toEqual([
      ['0.0-2.0', '1:1'],
      ['2.0-6.0', '1:2'],
      ['', '1:3'],
      ['', '1:4'],
      ['', '1:5'],
    ]);
  });

  it('adds a continuation row for the rest of a split last verse', () => {
    // The user split the last marked row to 1:3a. The remainder of verse 3
    // still has to be marked, so a 1:3b row appears ahead of the whole verses
    // that follow.
    const previous = table([
      ['0.0-2.0', '1:1'],
      ['2.0-4.0', '1:2'],
      ['4.0-6.0', '1:3a'],
      ['', '1:4'],
      ['', '1:5'],
    ]);

    const { newData } = rebuild(
      [region(0, 2, '1:1'), region(2, 4, '1:2'), region(4, 6, '1:3a')],
      previous
    );

    expect(rows(newData)).toEqual([
      ['0.0-2.0', '1:1'],
      ['2.0-4.0', '1:2'],
      ['4.0-6.0', '1:3a'],
      ['', '1:3b'],
      ['', '1:4'],
      ['', '1:5'],
    ]);
  });

  it('does not add a second continuation row when one is already in the table', () => {
    // Same split, but 1:3b is already a row (added by the previous rebuild).
    // Re-marking must not stack another copy of it.
    const previous = table([
      ['0.0-2.0', '1:1'],
      ['2.0-4.0', '1:2'],
      ['4.0-6.0', '1:3a'],
      ['', '1:3b'],
      ['', '1:4'],
      ['', '1:5'],
    ]);

    const { newData } = rebuild(
      [region(0, 2, '1:1'), region(2, 4, '1:2'), region(4, 6, '1:3a')],
      previous
    );

    expect(rows(newData)).toEqual([
      ['0.0-2.0', '1:1'],
      ['2.0-4.0', '1:2'],
      ['4.0-6.0', '1:3a'],
      ['', '1:3b'],
      ['', '1:4'],
      ['', '1:5'],
    ]);
  });

  it('marks the next subpart when marking a split verse', () => {
    // The user marked 1:2a and immediately marks the segment after it. The new
    // row continues the split verse with 1:2b rather than jumping to the next
    // whole verse the passage list would suggest.
    const newRegion = region(2, 4);
    const { newData, reset } = rebuild(
      [region(0, 2, '1:2a'), newRegion],
      table([['0.0-2.0', '1:2a']])
    );

    expect(rows(newData)).toEqual([
      ['0.0-2.0', '1:2a'],
      ['2.0-4.0', '1:2b'],
    ]);
    expect(newRegion.label).toBe('1:2b');
    expect(reset).toBe(true);
  });

  it('drops a covered row for a verse a range now covers', () => {
    // The user widened the first row to 1:1-2, which absorbs verse 2. The old
    // 1:2 row must not linger as a duplicate below it.
    const previous = table([
      ['0.0-4.0', '1:1-2'],
      ['', '1:2'],
      ['', '1:3'],
      ['', '1:4'],
      ['', '1:5'],
    ]);

    const { newData } = rebuild([region(0, 4, '1:1-2')], previous);

    expect(rows(newData)).toEqual([
      ['0.0-4.0', '1:1-2'],
      ['', '1:3'],
      ['', '1:4'],
      ['', '1:5'],
    ]);
  });

  it('ignores a saved label that repeats a verse already used above', () => {
    // Saved segments whose labels both read 1:1 (e.g. left over from an edit)
    // must not produce two rows for the same verse — the second region falls
    // back to the verse its row is waiting on.
    const { newData } = rebuild(
      [region(0, 2.5, '1:1'), region(2.5, 5, '1:1')],
      unmarkedTable(),
      true
    );

    expect(rows(newData)).toEqual([
      ['0.0-2.5', '1:1'],
      ['2.5-5.0', '1:2'],
      ['', '1:3'],
      ['', '1:4'],
      ['', '1:5'],
    ]);
  });

  it('flags an ill-formatted reference the user typed, and keeps the row', () => {
    // Hand-typed junk in a reference cell survives the rebuild so the user can
    // see and fix it, carrying the Err status the cell builder assigns.
    const previous = table([
      ['0.0-2.0', '1:1'],
      ['2.0-4.0', 'nonsense'],
      ['', '1:3'],
      ['', '1:4'],
      ['', '1:5'],
    ]);

    const { newData } = rebuild(
      [region(0, 2, '1:1'), region(2, 4, 'nonsense')],
      previous
    );

    expect(rows(newData)[1]).toEqual(['2.0-4.0', 'nonsense']);
    expect(newData[2][ColName.Ref].status).toBe(RefStatus.Err);
    expect(newData[1][ColName.Ref].status).toBe(RefStatus.Valid);
  });
});
