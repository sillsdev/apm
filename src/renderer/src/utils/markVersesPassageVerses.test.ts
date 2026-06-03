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
      start: { chapter: 1, verse: 24, suffix: '' },
      end: { chapter: 1, verse: 25, suffix: '' },
    });
    expect(markVersesReferenceHasLetterSuffix(parsed!)).toBe(false);
  });

  it('parses split-verse letter suffixes', () => {
    const parsed = parseMarkVersesReference('1:1a-2e');
    expect(parsed?.start.suffix).toBe('a');
    expect(parsed?.end.suffix).toBe('e');
    expect(markVersesReferenceHasLetterSuffix(parsed!)).toBe(true);
  });

  it('parses same-verse bare-suffix ranges (e.g. 1:1a-e)', () => {
    const parsed = parseMarkVersesReference('1:1a-e');
    expect(parsed).toEqual({
      start: { chapter: 1, verse: 1, suffix: 'a' },
      end: { chapter: 1, verse: 1, suffix: 'e' },
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
