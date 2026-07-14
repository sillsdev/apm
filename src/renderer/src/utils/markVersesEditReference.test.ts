import {
  evaluateMarkVersesReferenceStatus,
  isRefInVersification,
  isMarkVersesReferenceInPassage,
  isMarkVersesTableConsecutive,
  isValidMarkVersesReference,
  isWellFormedMarkVersesReference,
  markVersesReferenceConsecutivelyFollows,
  markVersesReferenceStartsPassage,
  markVersesRenumberLeadingRef,
  markVersesSkippedPassageRefs,
  MarkVersesWarningReason,
  shouldAutoRenumberAfterEdit,
  type MarkVersesEditReferenceContext,
} from './markVersesEditReference';
import { PassageD } from '../model';

/**
 * Build a minimal PassageD from a book and its start/end reference strings
 * (e.g. '1:2b'). Only the attributes the functions under test read are set. A
 * malformed bound (e.g. '' or 'junk') yields a missing/NaN attribute, which the
 * functions treat as "not in passage".
 */
const passageStub = (
  book: string,
  startRef: string,
  endRef: string
): PassageD => {
  // A plain verse is numeric (matching PassageD's `number` attribute); a verse
  // carrying a letter (e.g. `2b`) stays a string, which the functions split via
  // splitVerseSuffix. A malformed bound leaves the attribute undefined/NaN.
  const toVerse = (v: string | undefined): number | string | undefined =>
    v === undefined ? undefined : /^\d+$/.test(v) ? Number(v) : v;
  const [startChapter, startVerse] = startRef.split(':');
  const [endChapter, endVerse] = endRef.split(':');
  return {
    attributes: {
      book,
      startChapter: Number(startChapter),
      startVerse: toVerse(startVerse),
      endChapter: Number(endChapter),
      endVerse: toVerse(endVerse),
    },
  } as unknown as PassageD;
};

/**
 * TDD spec for the "what happens when a user edits a Mark Verses reference"
 * logic.
 *
 * "Re-number" === the redistribute-tail behavior in
 * redistributeTableTailAfterSave (PassageDetailMarkVerses).
 *
 * Versification comes from the real `eng-vrs` table via `getLastVerse`, so the
 * tests reference real books whose chapter shapes exercise the rules:
 * - `longChapter1` = `LUK`: chapter 1 has 80 verses (ch2=52, ch3=38, ch4=44),
 *   so 1:20 is NOT the last verse of its chapter — used for same-chapter cases.
 * - `chapter1EndsAt20` = `REV`: chapter 1 ends at verse 20, so 1:20 -> 2:1 is
 *   the legitimate chapter boundary — used for the cross-chapter cases.
 */
const longChapter1 = 'LUK';
const chapter1EndsAt20 = 'REV';

describe('isWellFormedMarkVersesReference', () => {
  it.each([
    '1:1',
    '1:1-4',
    '1:1a',
    '1:1a-2e',
    '1:1a-e',
    '1:30-2:2', // range across a single chapter boundary
    '1:80-2:1', // boundary at the end of a chapter
    '1:1-3:5', // range spanning two chapter boundaries
    '1:1-4:10', // range spanning several chapters
    '1:1-4:10a', // several-chapter span ending on a verse part
    '2:5a-4:23', // several-chapter span with a start verse part
    '100:1',
  ])('accepts well-formatted %s', (ref) => {
    expect(isWellFormedMarkVersesReference(ref)).toBe(true);
  });

  it.each([
    '1:3-1:1', // backwards within a chapter
    '4:10-1:1', // backwards across chapters (end chapter before start)
    '3:5-3:2', // backwards within a chapter (end verse before start)
    '1:1aa',
    '1',
    '#$%',
    'foo',
    '',
  ])('rejects ill-formatted %s', (ref) => {
    expect(isWellFormedMarkVersesReference(ref)).toBe(false);
  });
});

describe('isRefInVersification', () => {
  it('accepts verses that exist in the chapter', () => {
    expect(isRefInVersification('1:1', longChapter1)).toBe(true);
    expect(isRefInVersification('1:80', longChapter1)).toBe(true);
    expect(isRefInVersification('1:30-2:2', longChapter1)).toBe(true);
  });

  it('rejects a chapter that does not exist (e.g. 100:1)', () => {
    expect(isRefInVersification('100:1', longChapter1)).toBe(false);
  });

  it('rejects a verse past the end of its chapter', () => {
    expect(isRefInVersification('1:81', longChapter1)).toBe(false);
    expect(isRefInVersification('1:21', chapter1EndsAt20)).toBe(false);
  });
});

describe('isValidMarkVersesReference', () => {
  it('requires both well-formatted and in range', () => {
    expect(isValidMarkVersesReference('1:1', longChapter1)).toBe(true);
    // well-formatted but out of range
    expect(isValidMarkVersesReference('100:1', longChapter1)).toBe(false);
    // ill-formatted
    expect(isValidMarkVersesReference('1:1aa', longChapter1)).toBe(false);
  });
});

/**
 * `isValidMarkVersesReference` should agree with the legacy `refMatch` regex
 * (see __tests__/refMatch.test.ts): every reference refMatch treats as a match
 * is valid, and every reference it rejects is invalid. Cases are lifted straight
 * from refMatch.test.ts.
 *
 * These run against `longChapter1` (LUK), whose chapter 1 ends at verse 80 —
 * the versification the cross-chapter refMatch cases (`1:80-2:2`, `1:80-1:81`)
 * assume. refMatch itself is versification-blind, so a few of its verdicts are
 * expected to diverge; those cases are flagged inline.
 */
describe('isValidMarkVersesReference agrees with refMatch', () => {
  it.each([
    '1:1-4', // verse range
    '1:5', // single verse
    '1:1-4a', // verse range with letter
    '1:1c-4a', // verse range with two letters
    '1:25-2:4', // cross chapter boundary
    '1:2-4', // plain range (group-extraction case)
    '1:2c-4a', // lettered range (group-extraction case)
    '1:2c-2:4a', // cross-chapter lettered range (group-extraction case)
    '1:1-2', // beg < end
    '1:1a-2', // beg with letter < end
    '1:1-2a', // beg < end with letter
    '1:1a-2a', // beg with letter < end with letter
    '1:22a-b', // same-verse letter range
    '1:1b-c', // same-verse letter range
    '1:80-2:2', // cross chapter at the end of chapter 1 (LUK ch1 ends at 80)
    '1:80-3:2', // cross whole chapter (different from refMatch behavior)
  ])('accepts %s (refMatch matches)', (ref) => {
    expect(isValidMarkVersesReference(ref, longChapter1)).toBe(true);
  });

  it.each([
    '1:2-1', // beg > end
    '1:1b-1a', // beg letter > end letter
    '1:1c-b', // same-verse letter range, end before start
    '1:b-2c', // beg is a bare letter (no verse number)
    '1:b-c', // beg is a bare letter (no verse number)
    '1:80-1:81', // cross-chapter written as same chapter (1:81 is past LUK ch1's 80 verses)
  ])('rejects %s (refMatch does not match)', (ref) => {
    expect(isValidMarkVersesReference(ref, longChapter1)).toBe(false);
  });
});

describe('markVersesReferenceConsecutivelyFollows', () => {
  // X -> Y means "a row Y consecutively follows a row X" (Y is the row below X).
  describe('within a chapter', () => {
    it.each([
      ['1:3-5', '1:6-7'], // range then next range, no gap
      ['1:3a', '1:3b'], // next letter, same verse
      ['1:4a-c', '1:4d'], // continue letter sequence within the verse
      ['1:3b', '1:4'], // verse 3 complete (>= b) -> plain next verse
      ['1:3d', '1:4'], // verse 3 complete (>= b) -> plain next verse
      ['1:3b', '1:4a'], // verse 3 complete -> next verse starting at a
    ])('treats %s -> %s as sequential', (prev, next) => {
      expect(
        markVersesReferenceConsecutivelyFollows(prev, next, longChapter1)
      ).toBe(true);
    });

    it.each([
      ['1:3', '1:5'], // gap
      ['1:1-3', '1:3'], // duplicate / overlap (3 already covered)
      ['1:1a', '1:2'], // 1:1 only has part a; for now we are treating letters as all verses must have part b before moving on
      ['1:5', '1:2'], // backwards
      ['1:1a-c', '1:1c'], // c already covered; must be d
      ['1:1d', '1:1b'], // c skipped
      ['1:1', '1:2b'], // a split verse must start at part a, not b
      ['1:1a', '1:2b'],
      ['1:1a-2d', '1:3b'],
    ])('treats %s -> %s as NOT sequential', (prev, next) => {
      expect(
        markVersesReferenceConsecutivelyFollows(prev, next, longChapter1)
      ).toBe(false);
    });

    it('requires part b after part a (a verse with part a must also have part b)', () => {
      expect(
        markVersesReferenceConsecutivelyFollows('1:1a', '1:1b', longChapter1)
      ).toBe(true);
    });
  });

  describe('across a chapter boundary', () => {
    it('treats 1:20 -> 2:1 as sequential only when 1:20 is the last verse of chapter 1', () => {
      // chapter 1 ends at 20 -> crossing to 2:1 is the real boundary
      expect(
        markVersesReferenceConsecutivelyFollows('1:20', '2:1', chapter1EndsAt20)
      ).toBe(true);
      // chapter 1 has 80 verses -> 1:20 -> 2:1 skips 1:21..1:80
      expect(
        markVersesReferenceConsecutivelyFollows('1:20', '2:1', longChapter1)
      ).toBe(false);
    });

    it.each([
      ['1:20', '2:4'], // even at the boundary, must be verse 1 of the next chapter
      ['1:20', '3:1'], // skips chapter 2 entirely
    ])('treats %s -> %s as NOT sequential', (prev, next) => {
      expect(
        markVersesReferenceConsecutivelyFollows(prev, next, chapter1EndsAt20)
      ).toBe(false);
    });
  });

  // Here the individual *range* itself spans one or more chapter boundaries
  // (its start and end live in different chapters).
  describe('where an individual range spans chapter boundaries', () => {
    it.each([
      ['1:1-2:10', '2:11-2:30'], // range crosses 1->2; next picks up at 2:11
      ['1:78-2:5', '2:6-3:10'], // both ranges cross a boundary; contiguous at 2:5/2:6
      ['1:1-1:80', '2:1-3:5'], // prev ends at ch1's last verse; next spans 2->3 from 2:1
      ['1:1-4:10a', '4:10b-4:23'], // range spans multiple chapters; next continues letter b
    ])('treats %s -> %s as sequential', (prev, next) => {
      expect(
        markVersesReferenceConsecutivelyFollows(prev, next, longChapter1)
      ).toBe(true);
    });

    it.each([
      ['1:1-2:10', '2:12-2:30'], // gap: skips 2:11 after the crossing
      ['1:1-2:10', '2:10-2:30'], // overlap: 2:10 is covered twice
      ['1:1-2:10', '3:1-3:5'], // jumps to ch3, skipping the rest of ch2
      ['1:1-4:10a', '4:11-4:23'], // 4:10 only has part a (incomplete) -> skips 4:10b
      ['1:1-4:10a', '4:10c-4:23'], // wrong letter: skips part b
    ])('treats %s -> %s as NOT sequential', (prev, next) => {
      expect(
        markVersesReferenceConsecutivelyFollows(prev, next, longChapter1)
      ).toBe(false);
    });
  });
});

// Do we really need this function?
describe('isMarkVersesTableConsecutive', () => {
  it('accepts a fully consecutive table', () => {
    expect(
      isMarkVersesTableConsecutive(['1:1', '1:2', '1:3', '1:4'], longChapter1)
    ).toBe(true);
    expect(
      isMarkVersesTableConsecutive(['1:1-4', '1:5-7', '1:8-10'], longChapter1)
    ).toBe(true);
  });

  it('rejects a table with a gap or overlap', () => {
    expect(
      isMarkVersesTableConsecutive(['1:1-4', '1:3-6', '1:7-10'], longChapter1)
    ).toBe(false); // 1:1-4 then 1:3-6 overlaps
    expect(
      isMarkVersesTableConsecutive(['1:1', '1:2', '1:4'], longChapter1)
    ).toBe(false); // gap at 1:3
  });
});

describe('shouldAutoRenumberAfterEdit', () => {
  // Convenience overrides: `book` / `passageStartRef` / `passageEndRef` are
  // assembled into the context's PassageD.
  const ctx = (over: {
    newReference?: string;
    tableReferences?: string[];
    rowIndex?: number;
    book?: string;
    passageStartRef?: string;
    passageEndRef?: string;
  }): MarkVersesEditReferenceContext => ({
    newReference: over.newReference ?? '',
    tableReferences: over.tableReferences ?? [],
    rowIndex: over.rowIndex ?? 1,
    // Wide passage bounds so the existing cases turn only on the numbering
    // rules; the passage-bounds behavior is exercised separately below.
    passage: passageStub(
      over.book ?? longChapter1,
      over.passageStartRef ?? '1:1',
      over.passageEndRef ?? '1:80'
    ),
  });

  // Rule 1: anything ill-formatted or out of range anywhere in the resulting
  // table blocks re-numbering.
  describe('table has an ill-formatted or out-of-range reference', () => {
    it('never re-numbers when an existing row is out of range', () => {
      expect(
        shouldAutoRenumberAfterEdit(
          ctx({
            tableReferences: ['1:1', '100:1', '1:3'],
            newReference: '1:1-2',
            rowIndex: 0,
          })
        )
      ).toBe(false);
    });

    it('never re-numbers when an existing row is ill-formatted', () => {
      expect(
        shouldAutoRenumberAfterEdit(
          ctx({
            tableReferences: ['1:1', 'foo', '1:3'],
            newReference: '1:1-2',
            rowIndex: 0,
          })
        )
      ).toBe(false);
    });

    it('does not re-number when the edited result is ill-formatted', () => {
      expect(
        shouldAutoRenumberAfterEdit(
          ctx({
            tableReferences: ['1:1', '1:2', '1:3'],
            newReference: '1:1aa',
            rowIndex: 1,
          })
        )
      ).toBe(false);
    });

    it('does not re-number when the edited result is out of range', () => {
      expect(
        shouldAutoRenumberAfterEdit(
          ctx({
            tableReferences: ['1:1', '1:2', '1:3'],
            newReference: '100:1',
            rowIndex: 1,
          })
        )
      ).toBe(false);
    });

    it('does not re-number when the edit reaches outside the passage bounds', () => {
      // 1:3-9 is well-formed and within versification, but the passage ends at
      // 1:5, so extending to 1:9 leaves the passage — leave numbering alone.
      expect(
        shouldAutoRenumberAfterEdit(
          ctx({
            tableReferences: ['1:1', '1:2', '1:3'],
            newReference: '1:3-9',
            rowIndex: 2,
            passageStartRef: '1:1',
            passageEndRef: '1:5',
          })
        )
      ).toBe(false);
    });
  });

  // Rule 2: the new start must consecutively follow the end of the row above.
  describe('new start vs the row above', () => {
    it('does not re-number when the new start creates a gap with the row above', () => {
      expect(
        shouldAutoRenumberAfterEdit(
          ctx({
            tableReferences: ['1:1', '1:2', '1:3', '1:4'],
            newReference: '1:4', // start jumps from 2 to 4: gap, does not follow 1:1
            rowIndex: 1,
          })
        )
      ).toBe(false);
    });

    it('does not re-number when the new start overlaps the row above', () => {
      expect(
        shouldAutoRenumberAfterEdit(
          ctx({
            tableReferences: ['1:1', '1:2', '1:3', '1:4'],
            newReference: '1:2-3', // start 1:2 duplicates the 1:2 row above
            rowIndex: 2,
          })
        )
      ).toBe(false);
    });

    it('ignores the row-above rule for the first data row', () => {
      // No row above row 0, so rule 2 is skipped; above [] and below
      // (1:3, 1:4) are both sequential -> re-number.
      expect(
        shouldAutoRenumberAfterEdit(
          ctx({
            tableReferences: ['1:1', '1:3', '1:4'],
            newReference: '1:1-2',
            rowIndex: 0,
          })
        )
      ).toBe(true);
    });
  });

  // Rule 3: re-number only when everything above and everything below the
  // edited row are each internally sequential.
  describe('both halves around the edited row are sequential', () => {
    it('re-numbers a dropdown-style end extension on a clean table', () => {
      expect(
        shouldAutoRenumberAfterEdit(
          ctx({
            tableReferences: ['1:1', '1:2', '1:3', '1:4'],
            newReference: '1:3-4', // start unchanged, only end extended
            rowIndex: 2,
          })
        )
      ).toBe(true);
    });

    it('re-numbers when the edit heals the boundary with the row below', () => {
      // (1:1-4, 1:3-6, 1:7-10) -> edit row 1 to 1:5-7. Above (1:1-4) is
      // sequential, 1:5 follows 1:4, and below (1:7-10) is sequential; only the
      // 1:7 overlap between the edited row and the row below remains, which
      // re-numbering the tail absorbs.
      expect(
        shouldAutoRenumberAfterEdit(
          ctx({
            tableReferences: ['1:1-4', '1:3-6', '1:7-10'],
            newReference: '1:5-7',
            rowIndex: 1,
          })
        )
      ).toBe(true);
    });

    it('re-numbers when editing the last row (nothing below)', () => {
      expect(
        shouldAutoRenumberAfterEdit(
          ctx({
            tableReferences: ['1:1', '1:2', '1:3'],
            newReference: '1:3-5', // follows 1:2; below is empty (sequential)
            rowIndex: 2,
          })
        )
      ).toBe(true);
    });
  });

  describe('a break elsewhere in the table blocks re-numbering', () => {
    it('does not re-number when a row above the edit is not sequential', () => {
      // Pre-existing gap at 1:2 above the edited row (1:1, 1:3, 1:4); the edit
      // follows the row above it but the gap higher up is left untouched.
      expect(
        shouldAutoRenumberAfterEdit(
          ctx({
            tableReferences: ['1:1', '1:3', '1:4', '1:5'],
            newReference: '1:5-6',
            rowIndex: 3,
          })
        )
      ).toBe(false);
    });

    it('does not re-number when a row below the edit is not sequential', () => {
      // The edit follows the row above and above is sequential, but below has a
      // pre-existing gap (1:5 -> 1:7) the user did not touch, so leave the
      // numbering alone rather than silently shifting those rows.
      expect(
        shouldAutoRenumberAfterEdit(
          ctx({
            tableReferences: ['1:1', '1:2-3', '1:5', '1:7'],
            newReference: '1:2-4',
            rowIndex: 1,
          })
        )
      ).toBe(false);
    });
  });
});

describe('evaluateMarkVersesReferenceStatus (per-row warning reason)', () => {
  // The reference under test sits at `rowIndex` within `tableReferences`. The
  // passage covers 1:1..1:5, so a well-formed, in-versification reference beyond
  // 1:5 (e.g. 1:8) is out of range without being ill-formatted.
  const status = (
    tableReferences: string[],
    rowIndex: number,
    reference = tableReferences[rowIndex]
  ) =>
    evaluateMarkVersesReferenceStatus({
      newReference: reference,
      tableReferences,
      rowIndex,
      passage: passageStub(longChapter1, '1:1', '1:5'),
    });

  it('reports no reason for an empty reference', () => {
    expect(status(['1:1', '', '1:3'], 1)).toEqual({});
  });

  it('reports no reason for a reference that consecutively follows', () => {
    expect(status(['1:1', '1:2', '1:3'], 1)).toEqual({});
  });

  it('reports outOfRange for a well-formed reference outside the passage', () => {
    // 1:8 exists in the book but the passage ends at 1:5.
    expect(status(['1:1', '1:8', '1:3'], 1)).toEqual({
      reason: MarkVersesWarningReason.OutOfRange,
    });
  });

  it('reports illFormatted for a reference that fails refMatch', () => {
    expect(status(['1:1', '1:1aa', '1:3'], 1)).toEqual({
      reason: MarkVersesWarningReason.IllFormatted,
    });
  });

  it('reports skipsAhead when the start jumps past the next verse', () => {
    // 1:1 -> 1:4 leaves 1:2 and 1:3 skipped.
    expect(status(['1:1', '1:4', '1:5'], 1)).toEqual({
      reason: MarkVersesWarningReason.SkipsAhead,
    });
  });

  it('reports overlap when the verse duplicates a row above', () => {
    expect(status(['1:1', '1:2', '1:1', '1:4'], 2)).toEqual({
      reason: MarkVersesWarningReason.Overlap,
    });
  });

  it('does not report overlap for a later subpart of the row above (1:2a -> 1:2b)', () => {
    // 1:2b continues the split verse begun by 1:2a; distinct subparts of the
    // same verse are not an overlap.
    expect(status(['1:1', '1:2a', '1:2b', '1:3'], 2)).toEqual({});
  });

  it('reports overlap when a subpart duplicates a lettered row above', () => {
    // 1:2a is already assigned above, so a second 1:2a overlaps.
    expect(status(['1:1', '1:2a', '1:2a', '1:3'], 2)).toEqual({
      reason: MarkVersesWarningReason.Overlap,
    });
  });

  it('reports skipsAhead when a split verse starts mid-verse (1:1 -> 1:2b skips 1:2a)', () => {
    // 1:2b begins verse 2 at part b, skipping part a. A new split verse must
    // start at part a, so the leading subpart is a forward gap.
    expect(status(['1:1', '1:2b', '1:3'], 1)).toEqual({
      reason: MarkVersesWarningReason.SkipsAhead,
    });
  });

  it('reports skipsAhead for a mid-verse split range (1:1 -> 1:2b-c skips 1:2a)', () => {
    expect(status(['1:1', '1:2b-c', '1:3'], 1)).toEqual({
      reason: MarkVersesWarningReason.SkipsAhead,
    });
  });

  it('reports skipsAhead when a split verse skips an interior subpart (1:2a -> 1:2c skips 1:2b)', () => {
    expect(status(['1:1', '1:2a', '1:2c', '1:3'], 2)).toEqual({
      reason: MarkVersesWarningReason.SkipsAhead,
    });
  });

  it('reports no reason for a first row that starts the passage', () => {
    // Passage starts at 1:1, so a first row of 1:1 skips nothing.
    expect(status(['1:1', '1:2'], 0)).toEqual({});
  });

  it('reports skipsAhead for a first row (no preceding reference) that does not start the passage', () => {
    // Passage starts at 1:1, so a first row of 1:4 skips 1:1..1:3.
    expect(status(['1:4', '1:5'], 0)).toEqual({
      reason: MarkVersesWarningReason.SkipsAhead,
    });
  });

  it('reports outOfRange before skipsAhead for the first row', () => {
    // 1:8 is in the book but beyond the passage's 1:5 end.
    expect(status(['1:8', '1:5'], 0)).toEqual({
      reason: MarkVersesWarningReason.OutOfRange,
    });
  });

  describe('passage that starts and ends mid-verse (7:2b-4b)', () => {
    // Must not flag its first row (`7:2b`) as skipping the earlier part (`7:2a`) — that part
    // is outside the passage, not missing. The end verse's parts before the end
    // subpart (`7:4a`) are inside the passage, so the last row covers them as a
    // range (`7:4a-b`) and is likewise unflagged. These are the rows getRefs
    // auto-generates for this passage.
    const midVersePassage = {
      attributes: { book: longChapter1, reference: '7:2b-4b' },
    } as unknown as PassageD;
    const rows = ['7:2b', '7:3', '7:4a-b'];
    const midVerseStatus = (rowIndex: number) =>
      evaluateMarkVersesReferenceStatus({
        newReference: rows[rowIndex],
        tableReferences: rows,
        rowIndex,
        passage: midVersePassage,
      });

    it('does not flag the first row that starts the passage mid-verse', () => {
      expect(midVerseStatus(0)).toEqual({});
    });

    it('does not flag the interior whole-verse row', () => {
      expect(midVerseStatus(1)).toEqual({});
    });

    it('does not flag the ranged last row covering the included subparts', () => {
      expect(midVerseStatus(2)).toEqual({});
    });

    it('still flags a bare end subpart that skips the earlier part (7:4b)', () => {
      // Without the a-b range the last row (`7:4b`) leaves `7:4a` — which is in
      // the passage — skipped.
      expect(
        evaluateMarkVersesReferenceStatus({
          newReference: '7:4b',
          tableReferences: ['7:2b', '7:3', '7:4b'],
          rowIndex: 2,
          passage: midVersePassage,
        })
      ).toEqual({ reason: MarkVersesWarningReason.SkipsAhead });
    });
  });

  it('flags the whole end verse as out of range when the passage ends mid-verse', () => {
    // Passage reference 1:1-1:3a: the subpart is only in the reference string,
    // so 1:3 (all of verse 3) reaches past the passage end and is out of range.
    const passage = {
      attributes: {
        book: longChapter1,
        reference: '1:1-1:3a',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 3,
      },
    } as unknown as PassageD;
    expect(
      evaluateMarkVersesReferenceStatus({
        newReference: '1:3',
        tableReferences: ['1:1', '1:2', '1:3'],
        rowIndex: 2,
        passage,
      })
    ).toEqual({ reason: MarkVersesWarningReason.OutOfRange });
    // ...while the in-passage subpart 1:3a is accepted (no warning).
    expect(
      evaluateMarkVersesReferenceStatus({
        newReference: '1:3a',
        tableReferences: ['1:1', '1:2', '1:3a'],
        rowIndex: 2,
        passage,
      })
    ).toEqual({});
  });
});

describe('markVersesSkippedPassageRefs', () => {
  const passage = ['1:1', '1:2', '1:3', '1:4', '1:5'];

  it('lists passage verses strictly between the prior end and the new start', () => {
    expect(markVersesSkippedPassageRefs('1:1', '1:4', passage)).toEqual([
      '1:2',
      '1:3',
    ]);
  });

  it('returns empty when the new start immediately follows (no gap)', () => {
    expect(markVersesSkippedPassageRefs('1:2', '1:3', passage)).toEqual([]);
  });

  it('returns empty when the new start is not ahead (duplicate / backfill)', () => {
    expect(markVersesSkippedPassageRefs('1:3', '1:2', passage)).toEqual([]);
  });

  it('uses the prior reference end, not its start, as the lower bound', () => {
    expect(markVersesSkippedPassageRefs('1:1-2', '1:5', passage)).toEqual([
      '1:3',
      '1:4',
    ]);
  });

  it('lists passage verses before the new start when there is no preceding row', () => {
    expect(markVersesSkippedPassageRefs('', '1:4', passage)).toEqual([
      '1:1',
      '1:2',
      '1:3',
    ]);
    expect(markVersesSkippedPassageRefs(undefined, '1:4', passage)).toEqual([
      '1:1',
      '1:2',
      '1:3',
    ]);
  });

  it('returns empty with no preceding row when the new ref starts the passage', () => {
    expect(markVersesSkippedPassageRefs('', '1:1', passage)).toEqual([]);
  });

  it('returns empty when a reference is unparseable', () => {
    // Unparseable new ref: no start to bound the skipped range.
    expect(markVersesSkippedPassageRefs('1:1', 'nope', passage)).toEqual([]);
    // Non-empty but unparseable preceding ref: not treated as "no preceding row".
    expect(markVersesSkippedPassageRefs('bogus', '1:4', passage)).toEqual([]);
  });

  it('lists a skipped leading subpart when the new start begins mid-verse', () => {
    // 1:1 -> 1:2b skips part a of verse 2.
    expect(markVersesSkippedPassageRefs('1:1', '1:2b', passage)).toEqual([
      '1:2a',
    ]);
    // 1:1 -> 1:2b-c: the range's start (1:2b) still skips 1:2a.
    expect(markVersesSkippedPassageRefs('1:1', '1:2b-c', passage)).toEqual([
      '1:2a',
    ]);
    // 1:1 -> 1:2c skips parts a and b.
    expect(markVersesSkippedPassageRefs('1:1', '1:2c', passage)).toEqual([
      '1:2a',
      '1:2b',
    ]);
  });

  it('combines skipped whole verses with a skipped leading subpart', () => {
    // 1:1 -> 1:4b skips whole verses 1:2, 1:3 and part a of verse 4.
    expect(markVersesSkippedPassageRefs('1:1', '1:4b', passage)).toEqual([
      '1:2',
      '1:3',
      '1:4a',
    ]);
  });

  it('lists only the interior subpart skipped within one verse', () => {
    // 1:2a -> 1:2c: verse 2 is already covered from part a, so only 1:2b is
    // skipped.
    expect(markVersesSkippedPassageRefs('1:2a', '1:2c', passage)).toEqual([
      '1:2b',
    ]);
  });

  describe('passage that begins mid-verse (subpart start bound)', () => {
    // The passage starts at 7:2b (its first row), so part 7:2a is outside the
    // passage — never "skipped". passageRefs[0] carries the start subpart.
    const midVerse = ['7:2b', '7:3', '7:4a-b'];

    it('does not list the pre-passage subpart when the first row skips ahead', () => {
      // First row 7:2c skips 7:2b only; 7:2a is outside the passage.
      expect(markVersesSkippedPassageRefs('', '7:2c', midVerse)).toEqual([
        '7:2b',
      ]);
      expect(markVersesSkippedPassageRefs(undefined, '7:2d', midVerse)).toEqual(
        ['7:2b', '7:2c']
      );
    });

    it('still floors at the passage start when the passage begins at part a', () => {
      // Passage starting at a whole verse keeps part a in play.
      expect(markVersesSkippedPassageRefs('', '1:1c', ['1:1', '1:2'])).toEqual([
        '1:1a',
        '1:1b',
      ]);
    });
  });
});

/**
 * Spec for whether a Mark Verses reference falls inside the passage.
 *
 * Contract: the reference is "in passage" when the whole span it covers lies
 * within the passage — its start is at or after the passage's start and its end
 * is at or before the passage's end. The passage is contiguous so its two bounds
 * (start ref, end ref) fully describe it.
 *
 * Comparison is subpart-aware. A bound with no suffix (e.g. `1:5`) means the
 * whole verse, so any lettered part of that verse is inside it. A bound that
 * names a part (e.g. `1:2b`) is that exact part, so a part outside it — even in
 * the same verse (`1:2a`) — is outside the passage. An unparseable reference, or
 * a passage with a missing/unparseable bound, is never in the passage.
 */
describe('isMarkVersesReferenceInPassage', () => {
  describe('single-verse passage', () => {
    // start === end: the passage is exactly one verse.
    const inPassage = (ref: string) =>
      isMarkVersesReferenceInPassage(
        ref,
        passageStub(longChapter1, '1:1', '1:1')
      );

    it('accepts the one verse it contains', () => {
      expect(inPassage('1:1')).toBe(true);
    });

    it('accepts a lettered subpart of that verse', () => {
      expect(inPassage('1:1a')).toBe(true);
      expect(inPassage('1:1a-c')).toBe(true);
    });

    it('rejects any other verse', () => {
      expect(inPassage('1:2')).toBe(false);
      expect(inPassage('2:1')).toBe(false);
    });
  });

  describe('single-chapter passage', () => {
    // Passage covers 1:2 through 1:5.
    const inPassage = (ref: string) =>
      isMarkVersesReferenceInPassage(
        ref,
        passageStub(longChapter1, '1:2', '1:5')
      );

    it.each([
      '1:2', // first verse
      '1:5', // last verse
      '1:3', // interior single verse
      '1:2-5', // the whole passage as one range
      '1:3-4', // interior range
      '1:2a', // lettered subpart of an interior verse
      '1:2a-3e', // lettered range within the passage
    ])('accepts %s (within the passage)', (ref) => {
      expect(inPassage(ref)).toBe(true);
    });

    it.each([
      '1:6', // one past the last verse
      '2:1', // next chapter entirely
      '1:5-6', // starts inside but ends past the last verse
      '1:1', // before the first verse (parseable, but out)
      '1:4-8', // interior start, end well past the passage
    ])('rejects %s (reaches outside the passage)', (ref) => {
      expect(inPassage(ref)).toBe(false);
    });
  });

  describe('passage spanning multiple chapters', () => {
    // A contiguous selection crossing the 1->2 boundary: 1:30 through 2:2.
    const inPassage = (ref: string) =>
      isMarkVersesReferenceInPassage(
        ref,
        passageStub(longChapter1, '1:30', '2:2')
      );

    it.each([
      '1:30-2:2', // the full span
      '1:31-2:1', // interior range crossing the boundary
      '2:2', // last verse, in the second chapter
      '1:30', // first verse, in the first chapter
      '1:32a-2:1b', // lettered range crossing the boundary
    ])('accepts %s (within the multi-chapter passage)', (ref) => {
      expect(inPassage(ref)).toBe(true);
    });

    it.each([
      '1:29-2:2', // starts one verse before the passage begins
      '1:30-2:3', // ends one verse after the passage ends
      '3:1', // a chapter beyond the passage
      '1:1', // an earlier verse in the first chapter, before the passage
    ])('rejects %s (reaches outside the multi-chapter passage)', (ref) => {
      expect(inPassage(ref)).toBe(false);
    });
  });

  describe('passage bounds with lettered subparts', () => {
    // Passage covers 1:2a through 1:5c. A reference is not considered to be in the
    // passage if it contains subparts outside of the range
    const inPassage = (ref: string) =>
      isMarkVersesReferenceInPassage(
        ref,
        passageStub(longChapter1, '1:2b', '1:5c')
      );
    it.each([
      '1:2b', // first verse, first subpart
      '1:2d',
      '1:2d-1:3a',
      '1:5c', // last verse, last subpart
      '1:5a-b',
      '1:3b-1:4b', // interior
      '1:2b-1:5c', // the whole passage as one range
    ])('accepts %s (within the passage)', (ref) => {
      expect(inPassage(ref)).toBe(true);
    });

    it.each([
      '1:2a', // before the first subpart
      '1:5d', // after the last subpart
      '1:2', // before the first subpart (no letter includes all of verse 2)
      '1:1', // before the passage
      '1:6', // after the passage
      '1:2a-1:5c', // starts before the passage
      '1:2b-1:5d', // ends after the passage
    ])('rejects %s (reaches outside the passage)', (ref) => {
      expect(inPassage(ref)).toBe(false);
    });

    const inPassage2 = (ref: string) =>
      isMarkVersesReferenceInPassage(
        ref,
        passageStub(longChapter1, '1:2a', '1:5a')
      );
    // verse 1:2 is inside the passage because all of verse 2 is included
    it.each([
      '1:2', // before the first subpart (no letter includes all of verse 2)
    ])('accepts %s (within the passage)', (ref) => {
      expect(inPassage2(ref)).toBe(true);
    });

    // verse 1:5 is outside of passage because it implies at least a part b is included
    it.each([
      '1:5', // after the last subpart
    ])('rejects %s (reaches outside the passage)', (ref) => {
      expect(inPassage2(ref)).toBe(false);
    });
  });

  // In the real app the passage's `reference` string keeps the verse subpart
  // (e.g. `1:1-1:3a`) while the calculated startVerse/endVerse attributes are
  // plain numbers with the subpart stripped. The reference must therefore win,
  // so the passage end is treated consistently with any other subpart.
  describe('subparts retained in passage reference bounds', () => {
    const passage = {
      attributes: {
        book: longChapter1,
        reference: '1:1-1:3a',
        startChapter: 1,
        startVerse: 1,
        endChapter: 1,
        endVerse: 3,
      },
    } as unknown as PassageD;

    it('treats the whole end verse and later subparts as outside', () => {
      // 1:3 (all of verse 3) and 1:3b both reach past the passage end 1:3a.
      expect(isMarkVersesReferenceInPassage('1:3', passage)).toBe(false);
      expect(isMarkVersesReferenceInPassage('1:3b', passage)).toBe(false);
    });

    it('accepts the end subpart and everything before it', () => {
      expect(isMarkVersesReferenceInPassage('1:3a', passage)).toBe(true);
      expect(isMarkVersesReferenceInPassage('1:2', passage)).toBe(true);
    });

    it('honors a subpart on the passage start too', () => {
      const startPassage = {
        attributes: { book: longChapter1, reference: '1:2b-1:5' },
      } as unknown as PassageD;
      expect(isMarkVersesReferenceInPassage('1:2a', startPassage)).toBe(false);
      expect(isMarkVersesReferenceInPassage('1:2b', startPassage)).toBe(true);
    });

    it('parses the short range form (6:1-3a)', () => {
      const shortForm = {
        attributes: { book: longChapter1, reference: '6:1-3a' },
      } as unknown as PassageD;
      expect(isMarkVersesReferenceInPassage('6:3a', shortForm)).toBe(true);
      expect(isMarkVersesReferenceInPassage('6:3', shortForm)).toBe(false);
      expect(isMarkVersesReferenceInPassage('6:3b', shortForm)).toBe(false);
    });
  });

  describe('corner cases', () => {
    it('rejects an unparseable reference', () => {
      const passage = passageStub(longChapter1, '1:1', '1:3');
      expect(isMarkVersesReferenceInPassage('foo', passage)).toBe(false);
      expect(isMarkVersesReferenceInPassage('', passage)).toBe(false);
    });

    it('rejects when a passage bound is missing / unparseable', () => {
      expect(
        isMarkVersesReferenceInPassage(
          '1:1',
          passageStub(longChapter1, '', '1:3')
        )
      ).toBe(false);
      expect(
        isMarkVersesReferenceInPassage(
          '1:1',
          passageStub(longChapter1, '1:1', 'junk')
        )
      ).toBe(false);
    });
  });
});

/**
 * Spec for whether a reference's *start* lands exactly on the passage's start
 * verse.
 *
 * Contract: true only when the reference parses and its start chapter:verse
 * equals the passage's `startChapter`:`startVerse` and lands on the beginning of
 * that verse. Only the start of the reference matters (a range is judged by where
 * it begins). A letterless start or part `a` is the beginning of the verse; a
 * later subpart (`b`, `c`, …) starts mid-verse and does not match. A passage
 * missing either start attribute — or an unparseable reference — is never a match.
 */
describe('markVersesReferenceStartsPassage', () => {
  // Minimal passage stub: the function only reads attributes.startChapter and
  // attributes.startVerse.
  const passage = (startChapter?: number, startVerse?: number): PassageD =>
    ({ attributes: { startChapter, startVerse } }) as PassageD;

  it('accepts a single verse sitting on the passage start', () => {
    expect(markVersesReferenceStartsPassage('1:5', passage(1, 5))).toBe(true);
  });

  it('accepts a range whose start is the passage start (judged by its start)', () => {
    expect(markVersesReferenceStartsPassage('1:5-8', passage(1, 5))).toBe(true);
  });

  it('accepts part a on the start (part a is the beginning of the verse)', () => {
    expect(markVersesReferenceStartsPassage('1:5a', passage(1, 5))).toBe(true);
  });

  it('rejects a later subpart on the start (only part a begins the verse)', () => {
    // 1:5b starts partway through verse 5, so it does not sit on the passage
    // start (verse 5, which begins at part a).
    expect(markVersesReferenceStartsPassage('1:5b-7', passage(1, 5))).toBe(
      false
    );
  });

  it('accepts a cross-chapter passage start', () => {
    expect(markVersesReferenceStartsPassage('1:30-2:2', passage(1, 30))).toBe(
      true
    );
  });

  it('rejects a different verse in the same chapter', () => {
    expect(markVersesReferenceStartsPassage('1:6', passage(1, 5))).toBe(false);
    expect(markVersesReferenceStartsPassage('1:4', passage(1, 5))).toBe(false);
  });

  it('rejects a matching verse number in a different chapter', () => {
    expect(markVersesReferenceStartsPassage('2:5', passage(1, 5))).toBe(false);
  });

  it('rejects a range that ends at the passage start but begins before it', () => {
    // Judged by the start (1:3), not the end (1:5).
    expect(markVersesReferenceStartsPassage('1:3-5', passage(1, 5))).toBe(
      false
    );
  });

  it('rejects an unparseable reference', () => {
    expect(markVersesReferenceStartsPassage('foo', passage(1, 5))).toBe(false);
    expect(markVersesReferenceStartsPassage('', passage(1, 5))).toBe(false);
  });

  it('rejects when the passage has no start chapter', () => {
    expect(markVersesReferenceStartsPassage('1:5', passage(undefined, 5))).toBe(
      false
    );
  });

  it('rejects when the passage has no start verse', () => {
    expect(markVersesReferenceStartsPassage('1:5', passage(1, undefined))).toBe(
      false
    );
  });

  describe('passage that begins mid-verse (subpart start bound)', () => {
    // Passage 7:2b-4b begins at part b of verse 2; part a belongs to the
    // previous passage. A row starting at 7:2b therefore begins the passage.
    const midVerse = {
      attributes: { book: 'LUK', reference: '7:2b-4b' },
    } as unknown as PassageD;

    it('accepts a row starting at the passage start subpart', () => {
      expect(markVersesReferenceStartsPassage('7:2b', midVerse)).toBe(true);
    });

    it('rejects the whole verse (begins before the start subpart)', () => {
      expect(markVersesReferenceStartsPassage('7:2', midVerse)).toBe(false);
      expect(markVersesReferenceStartsPassage('7:2a', midVerse)).toBe(false);
    });

    it('rejects a later subpart (begins after the start subpart)', () => {
      expect(markVersesReferenceStartsPassage('7:2c', midVerse)).toBe(false);
    });
  });
});

describe('markVersesRenumberLeadingRef', () => {
  // A wide passage so the subpart-logic cases turn only on the reference itself;
  // every continuation they produce (1:1b..e, 1:2b/c, 1:3b) is comfortably in
  // range. The passage-bounds behavior is exercised separately at the end.
  const wide = passageStub(longChapter1, '1:1', '1:80');

  it('continues with part b when the reference ends at part a', () => {
    // A verse can never end at part a, so the next row must supply part b.
    expect(markVersesRenumberLeadingRef('1:1a', wide)).toBe('1:1b');
    expect(markVersesRenumberLeadingRef('1:3a', wide)).toBe('1:3b');
    // Ending a multi-verse range at part a of the end verse: same rule.
    expect(markVersesRenumberLeadingRef('1:1b-1:2a', wide)).toBe('1:2b');
    expect(markVersesRenumberLeadingRef('1:1a-1:2a', wide)).toBe('1:2b');
    expect(markVersesRenumberLeadingRef('1:1-1:2a', wide)).toBe('1:2b');
  });

  it('continues with the next letter when the end verse is covered from part a', () => {
    // The user chose to specify subparts (rather than writing 1:1 to indicate all of verse 1), so a
    // further part is implied.
    expect(markVersesRenumberLeadingRef('1:1a-b', wide)).toBe('1:1c');
    expect(markVersesRenumberLeadingRef('1:1a-c', wide)).toBe('1:1d');
    expect(markVersesRenumberLeadingRef('1:1a-d', wide)).toBe('1:1e');
    // A range spanning into a later verse covers that verse from part a.
    expect(markVersesRenumberLeadingRef('1:1-1:2b', wide)).toBe('1:2c');
  });

  it('moves to the next verse when a b+ end excludes part a of a single verse', () => {
    // The letter serves to drop the leading part; verses rarely have parts past b.
    // So we want to just go on to the next verse
    expect(markVersesRenumberLeadingRef('1:1b', wide)).toBeUndefined();
    expect(markVersesRenumberLeadingRef('1:1c', wide)).toBeUndefined();
    expect(markVersesRenumberLeadingRef('1:1d', wide)).toBeUndefined();
    expect(markVersesRenumberLeadingRef('1:1b-c', wide)).toBeUndefined();
    expect(markVersesRenumberLeadingRef('1:1b-d', wide)).toBeUndefined();
    expect(markVersesRenumberLeadingRef('1:1c-d', wide)).toBeUndefined();
  });

  it('treats a spanned-into end verse as covered from part a (1:1b-1:2b -> 1:2c)', () => {
    // The range enters verse 2, so verse 2 counts as covered from part a and
    // takes the "further part implied" branch. See the helper's doc comment.
    expect(markVersesRenumberLeadingRef('1:1b-1:2b', wide)).toBe('1:2c');
  });

  it('does not run past the last subpart (e)', () => {
    // There is no letter after e, so the tail falls back to the next passage
    // verse rather than an invalid 1:1f.
    expect(markVersesRenumberLeadingRef('1:1a-e', wide)).toBeUndefined();
  });

  it('yields no leading ref for a whole (non-split) verse or range', () => {
    expect(markVersesRenumberLeadingRef('1:1', wide)).toBeUndefined();
    expect(markVersesRenumberLeadingRef('1:1-3', wide)).toBeUndefined();
    expect(markVersesRenumberLeadingRef('1:30-2:2', wide)).toBeUndefined();
  });

  it('returns undefined for an unparseable reference', () => {
    expect(markVersesRenumberLeadingRef('foo', wide)).toBeUndefined();
    expect(markVersesRenumberLeadingRef('', wide)).toBeUndefined();
  });

  describe('drops a continuation that falls outside the passage', () => {
    it('does not continue past the passage end subpart', () => {
      // Passage ends at 9:5b; editing the last row to 9:5a-b would otherwise
      // imply a 9:5c continuation, but 9:5c is outside the passage — no extra
      // row.
      const passage = passageStub(longChapter1, '9:1', '9:5b');
      expect(markVersesRenumberLeadingRef('9:5a-b', passage)).toBeUndefined();
    });

    it('keeps a continuation that is still inside the passage', () => {
      // Whole-verse passage end (9:1-5): verse 5 has room past b, so splitting
      // the last row into a-b still implies a 9:5c continuation in range.
      const passage = passageStub(longChapter1, '9:1', '9:5');
      expect(markVersesRenumberLeadingRef('9:5a-b', passage)).toBe('9:5c');
    });
  });
});
