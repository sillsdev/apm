import {
  countPassageVerses,
  formatPassageEndingForProgress,
  formatTaskVerseLabelForProgress,
  passageVersePosition,
  parseTaskVerseLabel,
} from './passageVerseSpan';

describe('passageVerseSpan', () => {
  const sameChapter = {
    book: 'LUK',
    startChapter: 1,
    endChapter: 1,
    startVerse: 10,
    endVerse: 19,
  };

  it('counts verses in a same-chapter passage', () => {
    expect(countPassageVerses(sameChapter)).toBe(10);
  });

  it('returns position within passage for verse 11', () => {
    expect(passageVersePosition(sameChapter, '11')).toBe(2);
  });

  it('uses range start for position', () => {
    expect(passageVersePosition(sameChapter, '3-4')).toBe(-6);
  });

  it('parses task verse labels', () => {
    expect(parseTaskVerseLabel('11', 1)).toEqual({ chapter: 1, verse: 11 });
    expect(parseTaskVerseLabel('1:80', 1)).toEqual({ chapter: 1, verse: 80 });
    expect(parseTaskVerseLabel('1:80-2:1', 1)).toEqual({
      chapter: 1,
      verse: 80,
    });
  });

  it('counts cross-chapter passage verses', () => {
    const crossChapter = {
      book: 'LUK',
      startChapter: 1,
      endChapter: 2,
      startVerse: 80,
      endVerse: 2,
    };
    // LUK ch 1 ends at v 80; span is v80 + 2:1-2:2 = 3 verses
    expect(countPassageVerses(crossChapter)).toBe(3);
  });

  it('returns cross-chapter position for 2:1', () => {
    const crossChapter = {
      book: 'LUK',
      startChapter: 1,
      endChapter: 2,
      startVerse: 80,
      endVerse: 2,
    };
    expect(passageVersePosition(crossChapter, '2:1')).toBe(2);
    expect(passageVersePosition(crossChapter, '1:80')).toBe(1);
  });

  it('formats labels for progress', () => {
    expect(formatTaskVerseLabelForProgress(sameChapter, '11')).toBe('11');
    expect(formatPassageEndingForProgress(sameChapter)).toBe('19');
    const crossChapter = {
      book: 'LUK',
      startChapter: 1,
      endChapter: 2,
      startVerse: 80,
      endVerse: 2,
    };
    expect(formatTaskVerseLabelForProgress(crossChapter, '80')).toBe('1:80');
    expect(formatPassageEndingForProgress(crossChapter)).toBe('2:2');
  });
});
