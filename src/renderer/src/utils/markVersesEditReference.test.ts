import {
  decideMarkVersesEditReferenceAction,
  evaluateMarkVersesReferenceStatus,
  isMarkVersesReferenceInRange,
  isMarkVersesTableConsecutive,
  isValidMarkVersesReference,
  isWellFormedMarkVersesReference,
  markVersesReferenceConsecutivelyFollows,
  markVersesSkippedPassageRefs,
  type GetLastVerse,
  type MarkVersesEditReferenceContext,
} from './markVersesEditReference';

/**
 * TDD spec for the "what happens when a user edits a Mark Verses reference"
 * logic. The dialog currently only offers a constrained set of edits, but free
 * text entry is coming, so this exercises the full rule set. Many of these are
 * expected to FAIL until markVersesReferenceConsecutivelyFollows /
 * isMarkVersesTableConsecutive / decideMarkVersesEditReferenceAction are
 * implemented — the validity predicates already pass since they delegate to the
 * existing refMatch + versification utilities.
 *
 * "Re-number" === the redistribute-tail behavior in
 * redistributeTableTailAfterSave (PassageDetailMarkVersesIsMobile).
 */

/**
 * Versification stub where chapter 1 is long (80 verses), so 1:20 is NOT the
 * last verse of the chapter. Chapters 1..24 exist (LUK-shaped). Used for the
 * common same-chapter cases.
 */
const longChapter1: GetLastVerse = (chapter) => {
  const lengths: Record<number, number> = {
    1: 80,
    2: 52,
    3: 38,
    4: 44,
  };
  if (chapter >= 1 && chapter <= 24) return lengths[chapter] ?? 50;
  return null;
};

/**
 * Versification stub where chapter 1 ends at verse 20, so 1:20 -> 2:1 is the
 * legitimate chapter boundary. Used specifically for the cross-chapter cases.
 */
const chapter1EndsAt20: GetLastVerse = (chapter) => {
  const lengths: Record<number, number> = {
    1: 20,
    2: 25,
    3: 30,
  };
  if (chapter >= 1 && chapter <= 3) return lengths[chapter] ?? null;
  return null;
};

describe('isWellFormedMarkVersesReference', () => {
  it.each(['1:1', '1:1-4', '1:1a', '1:1a-2e', '1:1a-e', '1:30-2:2', '100:1'])(
    'accepts well-formatted %s',
    (ref) => {
      expect(isWellFormedMarkVersesReference(ref)).toBe(true);
    }
  );

  it.each(['1:3-1:1', '1:1aa', '1', '#$%', 'foo', ''])(
    'rejects ill-formatted %s',
    (ref) => {
      expect(isWellFormedMarkVersesReference(ref)).toBe(false);
    }
  );
});

describe('isMarkVersesReferenceInRange', () => {
  it('accepts verses that exist in the chapter', () => {
    expect(isMarkVersesReferenceInRange('1:1', longChapter1)).toBe(true);
    expect(isMarkVersesReferenceInRange('1:80', longChapter1)).toBe(true);
    expect(isMarkVersesReferenceInRange('1:30-2:2', longChapter1)).toBe(true);
  });

  it('rejects a chapter that does not exist (e.g. 100:1)', () => {
    expect(isMarkVersesReferenceInRange('100:1', longChapter1)).toBe(false);
  });

  it('rejects a verse past the end of its chapter', () => {
    expect(isMarkVersesReferenceInRange('1:81', longChapter1)).toBe(false);
    expect(isMarkVersesReferenceInRange('1:21', chapter1EndsAt20)).toBe(false);
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

describe('markVersesReferenceConsecutivelyFollows', () => {
  // X -> Y means "a row Y consecutively follows a row X" (Y is the row below X).
  describe('within a chapter', () => {
    it.each([
      ['1:3-5', '1:6-7'], // range then next range, no gap
      ['1:3a', '1:3b'], // next letter, same verse
      ['1:4a-c', '1:4d'], // continue letter sequence within the verse
      ['1:3b', '1:4'], // verse 3 complete (>= b) -> plain next verse
      ['1:3b', '1:4a'], // verse 3 complete -> next verse starting at a
    ])('treats %s -> %s as sequential', (prev, next) => {
      expect(
        markVersesReferenceConsecutivelyFollows(prev, next, longChapter1)
      ).toBe(true);
    });

    it.each([
      ['1:3', '1:5'], // gap
      ['1:1-3', '1:3'], // duplicate / overlap (3 already covered)
      ['1:1a', '1:2'], // 1:1 only has part a; must have part b before moving on
      ['1:5', '1:2'], // backwards
      ['1:1a-c', '1:1c'], // c already covered; must be d
      ['1:1d', '1:1b'], // suffix goes backwards
      ['1:1', '1:2b'], // a split verse must start at part a, not b
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
});

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

describe('decideMarkVersesEditReferenceAction', () => {
  const ctx = (
    over: Partial<MarkVersesEditReferenceContext>
  ): MarkVersesEditReferenceContext => ({
    previousReference: '',
    newReference: '',
    precedingReference: undefined,
    tableReferences: [],
    rowIndex: 1,
    getLastVerse: longChapter1,
    ...over,
  });

  describe('pre-existing table is out of range or ill-formatted', () => {
    it('never re-numbers when an existing row is out of range', () => {
      expect(
        decideMarkVersesEditReferenceAction(
          ctx({
            tableReferences: ['1:1', '100:1', '1:3'],
            previousReference: '1:1',
            newReference: '1:1-2',
            precedingReference: undefined,
            rowIndex: 0,
          })
        )
      ).toBe('none');
    });

    it('never re-numbers when an existing row is ill-formatted', () => {
      expect(
        decideMarkVersesEditReferenceAction(
          ctx({
            tableReferences: ['1:1', 'foo', '1:3'],
            previousReference: '1:1',
            newReference: '1:1-2',
            rowIndex: 0,
          })
        )
      ).toBe('none');
    });
  });

  describe('result is out of range or ill-formatted', () => {
    it('does not re-number when the result is ill-formatted', () => {
      expect(
        decideMarkVersesEditReferenceAction(
          ctx({
            tableReferences: ['1:1', '1:2', '1:3'],
            precedingReference: '1:1',
            previousReference: '1:2',
            newReference: '1:1aa',
            rowIndex: 1,
          })
        )
      ).toBe('none');
    });

    it('does not re-number when the result is out of range', () => {
      expect(
        decideMarkVersesEditReferenceAction(
          ctx({
            tableReferences: ['1:1', '1:2', '1:3'],
            precedingReference: '1:1',
            previousReference: '1:2',
            newReference: '100:1',
            rowIndex: 1,
          })
        )
      ).toBe('none');
    });
  });

  describe('pre-existing table was valid and consecutive', () => {
    it('re-numbers when the result still consecutively follows the row above (dropdown-style end extension)', () => {
      expect(
        decideMarkVersesEditReferenceAction(
          ctx({
            tableReferences: ['1:1', '1:2', '1:3', '1:4'],
            precedingReference: '1:2',
            previousReference: '1:3',
            newReference: '1:3-4', // start unchanged, only end extended
            rowIndex: 2,
          })
        )
      ).toBe('renumber');
    });

    it('does not re-number when the new start creates a gap with the row above', () => {
      expect(
        decideMarkVersesEditReferenceAction(
          ctx({
            tableReferences: ['1:1', '1:2', '1:3', '1:4'],
            precedingReference: '1:1',
            previousReference: '1:2',
            newReference: '1:4', // start jumps from 2 to 4: gap, does not follow 1:1
            rowIndex: 1,
          })
        )
      ).toBe('none');
    });
  });

  describe('pre-existing table had a duplicate / gap / non-consecutive situation', () => {
    it('re-numbers when the edit leaves only an overlap caused by the new end number', () => {
      // (1:1-4, 1:3-6, 1:7-10) -> edit row 1 to 1:5-7 -> (1:1-4, 1:5-7, 1:7-10).
      // Row above is now consecutive (5 follows 4); only the 1:7 overlap with the
      // row below remains, and it was caused by the new end number -> re-number
      // (expected resulting tail: 1:8-10).
      expect(
        decideMarkVersesEditReferenceAction(
          ctx({
            tableReferences: ['1:1-4', '1:3-6', '1:7-10'],
            precedingReference: '1:1-4',
            previousReference: '1:3-6',
            newReference: '1:5-7',
            rowIndex: 1,
          })
        )
      ).toBe('renumber');
    });

    it('does not re-number when the edit does not resolve the pre-existing non-consecutiveness', () => {
      // Pre-existing gap at 1:3 (1:1, 1:2, 1:4); editing the last row to 1:5 does
      // not fix the gap above it, so leave numbering alone.
      expect(
        decideMarkVersesEditReferenceAction(
          ctx({
            tableReferences: ['1:1', '1:2', '1:4'],
            precedingReference: '1:4',
            previousReference: '1:4',
            newReference: '1:5',
            rowIndex: 2,
          })
        )
      ).toBe('none');
    });

    // OPEN QUESTION (per Noel): is there an edge case in this last branch where a
    // well-ordered-except-for-the-new-overlap result should NOT be re-numbered?
    // One candidate: if the overlap is NOT actually caused by the edited end
    // number but by a pre-existing problem further down, re-numbering could
    // silently shift rows the user never touched. The example above is
    // deliberately the clean case; this edge case is left unasserted pending a
    // decision on the intended behavior.
    it.todo(
      'decide whether a pre-existing downstream overlap (not caused by this edit) should block re-numbering'
    );
  });
});

describe('evaluateMarkVersesReferenceStatus (per-row warning reason)', () => {
  // The reference under test sits at `rowIndex` within `tableReferences`.
  const status = (
    tableReferences: string[],
    rowIndex: number,
    reference = tableReferences[rowIndex]
  ) =>
    evaluateMarkVersesReferenceStatus(
      reference,
      tableReferences,
      rowIndex,
      longChapter1
    );

  it('reports no reason for an empty reference', () => {
    expect(status(['1:1', '', '1:3'], 1)).toEqual({});
  });

  it('reports no reason for a reference that consecutively follows', () => {
    expect(status(['1:1', '1:2', '1:3'], 1)).toEqual({});
  });

  it('reports outOfRange for a well-formed but out-of-range reference', () => {
    expect(status(['1:1', '100:1', '1:3'], 1)).toEqual({
      reason: 'outOfRange',
    });
  });

  it('reports illFormatted for a reference that fails refMatch', () => {
    expect(status(['1:1', '1:1aa', '1:3'], 1)).toEqual({
      reason: 'illFormatted',
    });
  });

  it('reports skipsAhead when the start jumps past the next verse', () => {
    // 1:1 -> 1:4 leaves 1:2 and 1:3 skipped.
    expect(status(['1:1', '1:4', '1:5'], 1)).toEqual({ reason: 'skipsAhead' });
  });

  it('reports overlap when the verse duplicates a row above', () => {
    expect(status(['1:1', '1:2', '1:1', '1:4'], 2)).toEqual({
      reason: 'overlap',
    });
  });

  it('treats a non-consecutive reference that neither overlaps nor skips ahead as valid', () => {
    // 1:1 -> 1:2b is non-consecutive (a new split verse must start at part a)
    // but its verse (1:2) neither overlaps the row above (1:1) nor skips ahead.
    expect(status(['1:1', '1:2b', '1:3'], 1)).toEqual({});
  });

  it('checks only range/format for the first row (no preceding reference)', () => {
    expect(status(['1:4', '1:5'], 0)).toEqual({});
    expect(status(['100:1', '1:5'], 0)).toEqual({ reason: 'outOfRange' });
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

  it('returns empty when either reference is unparseable', () => {
    expect(markVersesSkippedPassageRefs('', '1:4', passage)).toEqual([]);
    expect(markVersesSkippedPassageRefs('1:1', 'nope', passage)).toEqual([]);
  });
});
