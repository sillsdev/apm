import { applyVerseSegment, openingChapter } from './verseSegmentText';

// The transcription Next Segment produced for Ecclesiastes 1:12–2:26 (TT-6862).
const missingChapter2Verses12To18 =
  '\\v 12  \\v 13  \\v 14  \\v 15  \\v 16  \\v 17  \\v 18  \\c 2  \\v 1  \\v 2  \\v 3  \\v 4  \\v 5  \\v 6  \\v 7  \\v 8  \\v 9  \\v 10  \\v 11  \\v 19  \\v 20  \\v 21  \\v 22  \\v 23  \\v 24  \\v 25  \\v 26 ';

const withChapter2Verse12 =
  '\\v 12  \\v 13  \\v 14  \\v 15  \\v 16  \\v 17  \\v 18  \\c 2  \\v 1  \\v 2  \\v 3  \\v 4  \\v 5  \\v 6  \\v 7  \\v 8  \\v 9  \\v 10  \\v 11  \\v 19  \\v 20  \\v 21  \\v 22  \\v 23  \\v 24  \\v 25  \\v 26  \\v 12 ';

describe('applyVerseSegment', () => {
  test('inserts chapter 2 verse 12 when chapter 1 already has verse 12', () => {
    const edit = applyVerseSegment(missingChapter2Verses12To18, '2:12');
    expect(edit.text).toBe(withChapter2Verse12);
  });

  test('moves the caret to chapter 2 verse 12 when that tag is already there', () => {
    const edit = applyVerseSegment(withChapter2Verse12, '2:12');
    expect(edit.text).toBe(withChapter2Verse12);
    expect(edit.caret).toBe(179);
  });

  test('inserts the chapter and verse into an empty transcription', () => {
    const edit = applyVerseSegment('', '2:12');
    expect(edit.text).toBe(' \\c 2  \\v 12 ');
    expect(edit.caret).toBe(13);
  });

  test('reuses the unmarked opening verse of a passage starting in chapter 2', () => {
    const edit = applyVerseSegment('\\v 12 ', '2:12', 6, '2');
    expect(edit.text).toBe('\\v 12 ');
    expect(edit.caret).toBe(0);
  });

  test('advances from the unmarked opening verse without a chapter marker', () => {
    const edit = applyVerseSegment('\\v 12 ', '2:13', 6, '2');
    expect(edit.text).toBe('\\v 12  \\v 13 ');
    expect(edit.caret).toBe(13);
  });

  test('marks the next chapter after an unmarked opening chapter 2', () => {
    const edit = applyVerseSegment('\\v 12  \\v 13 ', '3:1', 13, '2');
    expect(edit.text).toBe('\\v 12  \\v 13  \\c 3  \\v 1 ');
  });

  test('marks the chapter when the first segment is not in the opening chapter', () => {
    const edit = applyVerseSegment('', '2:12', 0, '1');
    expect(edit.text.trimStart()).toBe('\\c 2  \\v 12 ');
  });

  test('replaces the selected text with the inserted verse tag', () => {
    const edit = applyVerseSegment('hello wrong world', '1:3', 6, '1', 11);
    expect(edit.text).toBe('hello  \\v 3  world');
    expect(edit.caret).toBe(12);
  });

  test('keeps the selected text when the verse tag is already there', () => {
    const edit = applyVerseSegment('\\v 3 hello wrong', '1:3', 11, '1', 16);
    expect(edit.text).toBe('\\v 3 hello wrong');
    expect(edit.caret).toBe(0);
  });

  test('leaves the transcription unchanged when the reference is empty', () => {
    const edit = applyVerseSegment('\\v 12 ', '');
    expect(edit.text).toBe('\\v 12 ');
    expect(edit.caret).toBe(6);
  });
});

describe('openingChapter', () => {
  test('uses the passage start chapter', () => {
    expect(openingChapter(2, '3:1')).toBe('2');
  });

  test('falls back to the first verse segment chapter', () => {
    expect(openingChapter(undefined, '2:12')).toBe('2');
    expect(openingChapter(0, '2:12')).toBe('2');
  });

  test('defaults to chapter 1', () => {
    expect(openingChapter(undefined, undefined)).toBe('1');
  });
});
