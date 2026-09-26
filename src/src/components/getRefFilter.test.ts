import { getRefFilter } from './getRefFilter';

describe('getRefFilter', () => {
  const bookCode = 'GEN';
  const book = { short: 'Gen' } as any;

  it('parses single verse 1:1', () => {
    const result = getRefFilter(bookCode, '1:1', book);
    expect(result).toEqual({
      bookName: 'Gen',
      chapterNumbers: '1',
      verseRange: '1',
    });
  });

  it('parses single verse with suffix 1:1a', () => {
    const result = getRefFilter(bookCode, '1:1a', book);
    expect(result).toEqual({
      bookName: 'Gen',
      chapterNumbers: '1',
      verseRange: '1a',
    });
  });

  it('parses single-chapter range 1:1-4', () => {
    const result = getRefFilter(bookCode, '1:1-4', book);
    expect(result).toEqual({
      bookName: 'Gen',
      chapterNumbers: '1',
      verseRange: '1-4',
    });
  });

  it('parses single-chapter range with suffixes 1:1b-4a', () => {
    const result = getRefFilter(bookCode, '1:1b-4a', book);
    expect(result).toEqual({
      bookName: 'Gen',
      chapterNumbers: '1',
      verseRange: '1b-4a',
    });
  });

  it('parses spanning range 1:3-2:1', () => {
    const result = getRefFilter(bookCode, '1:3-2:1', book);
    expect(result).toEqual({
      bookName: 'Gen',
      chapterNumbers: '1,2',
      verseRange: '1:3-2:1',
    });
  });

  it('parses spanning range with suffixes 1:31b-2:3a', () => {
    const result = getRefFilter(bookCode, '1:31b-2:3a', book);
    expect(result).toEqual({
      bookName: 'Gen',
      chapterNumbers: '1,2',
      verseRange: '1:31b-2:3a',
    });
  });
});
