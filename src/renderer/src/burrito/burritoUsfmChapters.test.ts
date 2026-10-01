import {
  ensureParagraphAfterChapter,
  lastChapterMarker,
} from './burritoUsfmChapters';

describe('ensureParagraphAfterChapter', () => {
  it('inserts \\p between \\c and \\v', () => {
    expect(ensureParagraphAfterChapter('\\c 2\n\\v 1 a')).toBe(
      '\\c 2\n\\p\n\\v 1 a'
    );
  });

  it('inserts \\p between \\c and plain text', () => {
    expect(ensureParagraphAfterChapter('\\c 4\n1 text')).toBe(
      '\\c 4\n\\p\n1 text'
    );
  });

  it('drops trailing spaces after the chapter number', () => {
    expect(ensureParagraphAfterChapter('\\c 2  \n\\v 1 a')).toBe(
      '\\c 2\n\\p\n\\v 1 a'
    );
  });

  it('adds \\p when \\c ends the content', () => {
    expect(ensureParagraphAfterChapter('\\v 1 a\n\\c 2')).toBe(
      '\\v 1 a\n\\c 2\n\\p\n'
    );
  });

  it('leaves chapters already followed by a paragraph or section alone', () => {
    const usfm =
      '\\c 1\n\\s Head\n\\p\n\\v 1 a\n\\c 2\n\\p\n\\v 1 b\n\\c 3\n\\q1 c';
    expect(ensureParagraphAfterChapter(usfm)).toBe(usfm);
  });

  it('handles several chapters in one document', () => {
    expect(
      ensureParagraphAfterChapter(
        '\\c 1\n\\v 1 a\n\\c 2\n\\p\n\\v 1 b\n\\c 3\n\\v 1 c'
      )
    ).toBe('\\c 1\n\\p\n\\v 1 a\n\\c 2\n\\p\n\\v 1 b\n\\c 3\n\\p\n\\v 1 c');
  });

  it('ignores markers that only start with c', () => {
    const usfm = '\\cl Psalm\n\\cd note';
    expect(ensureParagraphAfterChapter(usfm)).toBe(usfm);
  });
});

describe('lastChapterMarker', () => {
  it('returns undefined when there is no chapter marker', () => {
    expect(lastChapterMarker('\\v 1 a')).toBeUndefined();
  });

  it('returns the last chapter number', () => {
    expect(lastChapterMarker('\\v 27 a\n\\c 2  \n\\v 1 b\n\\c 3\n\\v 1')).toBe(
      3
    );
  });
});
