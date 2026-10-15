import { applyVerseSegment } from './verseSegmentText';

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

  test('leaves the transcription unchanged when the reference is empty', () => {
    const edit = applyVerseSegment('\\v 12 ', '');
    expect(edit.text).toBe('\\v 12 ');
    expect(edit.caret).toBe(6);
  });
});
