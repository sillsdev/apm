import {
  editReferenceValuesEqual,
  formatMarkVersesReference,
  getEndingVerseOptions,
  incrementMarkVersesReferenceSuffix,
  markVersesReferenceHasLetterSuffix,
  nextMarkVersesLetterSuffix,
  parseMarkVersesReference,
  passageRefsToVerseOptions,
} from './markVersesPassageVerses';

describe('markVersesPassageVerses', () => {
  const passage = ['1:1', '1:2', '1:3', '1:4'];

  it('lists ending verses from the current verse through the passage end', () => {
    expect(
      getEndingVerseOptions(passage, 1, 1).map((option) => option.key)
    ).toEqual(['1:1', '1:2', '1:3', '1:4']);
    expect(
      getEndingVerseOptions(passage, 1, 3).map((option) => option.key)
    ).toEqual(['1:3', '1:4']);
  });

  it('supports cross-chapter passage ranges', () => {
    const crossChapter = ['1:30', '1:31', '2:1', '2:2'];
    expect(
      passageRefsToVerseOptions(crossChapter).map((option) => option.key)
    ).toEqual(crossChapter);
    expect(
      getEndingVerseOptions(crossChapter, 1, 31).map((option) => option.key)
    ).toEqual(['1:31', '2:1', '2:2']);
  });

  it('keys a ranged last row by its start verse (7:2b-4b -> ...7:4)', () => {
    // A passage ending mid-verse auto-generates a ranged final row (`7:4a-b`);
    // its verse option is still verse 7:4, so the ending dropdown lists it.
    const midVerse = ['7:2b', '7:3', '7:4a-b'];
    expect(
      passageRefsToVerseOptions(midVerse).map((option) => option.key)
    ).toEqual(['7:2', '7:3', '7:4']);
    expect(
      getEndingVerseOptions(midVerse, 7, 3).map((option) => option.key)
    ).toEqual(['7:3', '7:4']);
  });

  it('formats single-verse and range references', () => {
    expect(
      formatMarkVersesReference({
        startChapter: 1,
        startVerse: 1,
        startSuffix: '',
        endChapter: 1,
        endVerse: 1,
        endSuffix: '',
        splitVerse: false,
      })
    ).toBe('1:1');

    expect(
      formatMarkVersesReference({
        startChapter: 1,
        startVerse: 1,
        startSuffix: '',
        endChapter: 1,
        endVerse: 3,
        endSuffix: '',
        splitVerse: false,
      })
    ).toBe('1:1-3');

    expect(
      formatMarkVersesReference({
        startChapter: 1,
        startVerse: 30,
        startSuffix: '',
        endChapter: 2,
        endVerse: 2,
        endSuffix: '',
        splitVerse: false,
      })
    ).toBe('1:30-2:2');
  });

  it('parses same-chapter ranges without treating verse numbers as suffixes', () => {
    const parsed = parseMarkVersesReference('1:24-25');
    expect(parsed).toEqual({
      start: { chapter: 1, verse: 24, verseLetterSuffix: '' },
      end: { chapter: 1, verse: 25, verseLetterSuffix: '' },
    });
    expect(markVersesReferenceHasLetterSuffix(parsed!)).toBe(false);
  });

  it('parses split-verse letter suffixes', () => {
    const parsed = parseMarkVersesReference('1:1a-2e');
    expect(parsed?.start.verseLetterSuffix).toBe('a');
    expect(parsed?.end.verseLetterSuffix).toBe('e');
    expect(markVersesReferenceHasLetterSuffix(parsed!)).toBe(true);
  });

  it('parses same-verse bare-suffix ranges (e.g. 1:1a-e)', () => {
    const parsed = parseMarkVersesReference('1:1a-e');
    expect(parsed).toEqual({
      start: { chapter: 1, verse: 1, verseLetterSuffix: 'a' },
      end: { chapter: 1, verse: 1, verseLetterSuffix: 'e' },
    });
    expect(markVersesReferenceHasLetterSuffix(parsed!)).toBe(true);
  });

  it('formats split-verse suffix ranges', () => {
    expect(
      formatMarkVersesReference({
        startChapter: 1,
        startVerse: 1,
        startSuffix: 'a',
        endChapter: 1,
        endVerse: 2,
        endSuffix: 'e',
        splitVerse: true,
      })
    ).toBe('1:1a-2e');

    // Same-verse suffix range produces a bare suffix end (e.g. "1:1a-e")
    expect(
      formatMarkVersesReference({
        startChapter: 1,
        startVerse: 1,
        startSuffix: 'a',
        endChapter: 1,
        endVerse: 1,
        endSuffix: 'e',
        splitVerse: true,
      })
    ).toBe('1:1a-e');

    // Same subpart on both ends collapses to a single subpart, not a range
    // (e.g. 1:1a-1:1a -> "1:1a", not "1:1a-a").
    expect(
      formatMarkVersesReference({
        startChapter: 1,
        startVerse: 1,
        startSuffix: 'a',
        endChapter: 1,
        endVerse: 1,
        endSuffix: 'a',
        splitVerse: true,
      })
    ).toBe('1:1a');
  });

  describe('nextMarkVersesLetterSuffix', () => {
    it('advances a..d to the next letter', () => {
      expect(nextMarkVersesLetterSuffix('a')).toBe('b');
      expect(nextMarkVersesLetterSuffix('b')).toBe('c');
      expect(nextMarkVersesLetterSuffix('c')).toBe('d');
      expect(nextMarkVersesLetterSuffix('d')).toBe('e');
    });

    it('returns undefined past e, for empty, and for non-letters', () => {
      expect(nextMarkVersesLetterSuffix('e')).toBeUndefined();
      expect(nextMarkVersesLetterSuffix('')).toBeUndefined();
      expect(nextMarkVersesLetterSuffix('f')).toBeUndefined();
      expect(nextMarkVersesLetterSuffix('1')).toBeUndefined();
    });
  });

  describe('incrementMarkVersesReferenceSuffix', () => {
    it('returns same-verse next-letter for a single-letter ref', () => {
      expect(incrementMarkVersesReferenceSuffix('1:11a')).toBe('1:11b');
      expect(incrementMarkVersesReferenceSuffix('2:3c')).toBe('2:3d');
    });

    it('uses the end suffix for a cross-verse range', () => {
      expect(incrementMarkVersesReferenceSuffix('1:1a-2b')).toBe('1:2c');
    });

    it('returns undefined for refs with no letter suffix', () => {
      expect(incrementMarkVersesReferenceSuffix('1:11')).toBeUndefined();
      expect(incrementMarkVersesReferenceSuffix('1:11-13')).toBeUndefined();
      expect(incrementMarkVersesReferenceSuffix('')).toBeUndefined();
    });

    it('returns undefined when the next letter would exceed e', () => {
      expect(incrementMarkVersesReferenceSuffix('1:11e')).toBeUndefined();
    });
  });

  describe('editReferenceValuesEqual', () => {
    const singleVerse = {
      splitVerse: false,
      startChapter: 1,
      startVerse: 1,
      startSuffix: '',
      endChapter: 1,
      endVerse: 1,
      endSuffix: '',
    };

    it('treats identical single-verse values as equal', () => {
      expect(editReferenceValuesEqual(singleVerse, { ...singleVerse })).toBe(
        true
      );
    });

    it('treats same range with split toggled and empty suffixes as equal', () => {
      const range = {
        splitVerse: false,
        startChapter: 1,
        startVerse: 1,
        startSuffix: '',
        endChapter: 1,
        endVerse: 3,
        endSuffix: '',
      };
      expect(
        editReferenceValuesEqual(range, { ...range, splitVerse: true })
      ).toBe(true);
    });

    it('treats different end verses as not equal', () => {
      expect(
        editReferenceValuesEqual(singleVerse, {
          ...singleVerse,
          endVerse: 2,
        })
      ).toBe(false);
    });

    it('treats letter-suffix references as not equal to plain references', () => {
      expect(
        editReferenceValuesEqual(singleVerse, {
          ...singleVerse,
          splitVerse: true,
          startSuffix: 'a',
          endSuffix: 'e',
        })
      ).toBe(false);
    });

    it('treats split toggled on and off without suffix change as equal to original', () => {
      expect(
        editReferenceValuesEqual(singleVerse, {
          ...singleVerse,
          splitVerse: true,
        })
      ).toBe(true);
    });
  });
});
