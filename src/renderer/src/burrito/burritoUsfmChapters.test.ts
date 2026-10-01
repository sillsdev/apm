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

  describe('inline chapter transitions (Paratext text import)', () => {
    it('moves an inline \\c before \\v onto its own line with \\p', () => {
      expect(ensureParagraphAfterChapter('\\v 27 End \\c 2 \\v 1 Start')).toBe(
        '\\v 27 End\n\\c 2\n\\p\n\\v 1 Start'
      );
    });

    it('handles \\c glued to the previous verse text', () => {
      expect(
        ensureParagraphAfterChapter('\\v 27 End\\c 2 \\v 1 Start\\v 2 More')
      ).toBe('\\v 27 End\n\\c 2\n\\p\n\\v 1 Start\\v 2 More');
    });

    it('handles \\c glued to the next \\v', () => {
      expect(ensureParagraphAfterChapter('\\v 27 End \\c 2\\v 1 Start')).toBe(
        '\\v 27 End\n\\c 2\n\\p\n\\v 1 Start'
      );
    });

    it('handles inline \\c followed by plain text', () => {
      expect(ensureParagraphAfterChapter('\\v 27 End \\c 2 Start')).toBe(
        '\\v 27 End\n\\c 2\n\\p\nStart'
      );
    });

    it('handles a leading inline \\c at the start of a line', () => {
      expect(ensureParagraphAfterChapter('\\p\n\\c 2 \\v 1 Start')).toBe(
        '\\p\n\\c 2\n\\p\n\\v 1 Start'
      );
    });

    it('handles multi-digit chapters', () => {
      expect(ensureParagraphAfterChapter('\\v 7 a \\c 12 \\v 1 b')).toBe(
        '\\v 7 a\n\\c 12\n\\p\n\\v 1 b'
      );
    });
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
