import { formatAsrProgressMessage } from './asrProgressMessage';

const template =
  'Transcribing {0} (verse {1}) of {2} (ending at verse {3})';

describe('formatAsrProgressMessage', () => {
  it('formats same-chapter progress', () => {
    const passage = {
      book: 'LUK',
      startChapter: 1,
      endChapter: 1,
      startVerse: 10,
      endVerse: 19,
    };
    expect(formatAsrProgressMessage(template, passage, '11')).toBe(
      'Transcribing 2 (verse 11) of 10 (ending at verse 19)'
    );
  });

  it('formats range label progress', () => {
    const passage = {
      book: 'LUK',
      startChapter: 1,
      endChapter: 1,
      startVerse: 1,
      endVerse: 5,
    };
    expect(formatAsrProgressMessage(template, passage, '3-4')).toBe(
      'Transcribing 3 (verse 3-4) of 5 (ending at verse 5)'
    );
  });

  it('formats cross-chapter progress', () => {
    const passage = {
      book: 'LUK',
      startChapter: 1,
      endChapter: 2,
      startVerse: 80,
      endVerse: 2,
    };
    expect(formatAsrProgressMessage(template, passage, '1:80')).toBe(
      'Transcribing 1 (verse 1:80) of 3 (ending at verse 2:2)'
    );
  });
});
