import {
  applyAsrTranscription,
  cleanAsrTranscription,
  findEmptyVerseMarkerInsertIndex,
  parseVerseFromAsrChunk,
  verseHasTranscriptionContent,
} from './applyAsrTranscription';

describe('applyAsrTranscription', () => {
  it('inserts text after an empty verse marker', () => {
    const result = applyAsrTranscription(
      '\\v 11 ',
      '\\v 11 Hello from ASR'
    );
    expect(result).toBe('\\v 11 Hello from ASR');
  });

  it('does not overwrite when verse already has content', () => {
    const current = '\\v 11 Manual text';
    expect(
      applyAsrTranscription(current, '\\v 11 ASR would overwrite')
    ).toBe(current);
  });

  it('appends marker and text when marker is missing', () => {
    const result = applyAsrTranscription('', '\\v 12 New verse text');
    expect(result).toBe('\\v 12 New verse text');
  });

  it('handles verse range labels such as 3-4', () => {
    const result = applyAsrTranscription(
      '\\v 3-4 ',
      '\\v 3-4 Range text here'
    );
    expect(result).toBe('\\v 3-4 Range text here');
  });

  it('skips duplicate ASR text', () => {
    const current = '\\v 10 already here';
    expect(applyAsrTranscription(current, '\\v 10 already here')).toBe(
      current
    );
  });

  it('strips timestamp prefixes from ASR chunks', () => {
    expect(cleanAsrTranscription('0:01.0: \\v 5 text')).toBe('\\v 5 text');
  });
});

describe('parseVerseFromAsrChunk', () => {
  it('parses verse label and text', () => {
    expect(parseVerseFromAsrChunk('\\v 11 Hello')).toEqual({
      verseLabel: '11',
      text: 'Hello',
    });
  });

  it('parses range labels', () => {
    expect(parseVerseFromAsrChunk('\\v 3-4 Hello')).toEqual({
      verseLabel: '3-4',
      text: 'Hello',
    });
  });
});

describe('verseHasTranscriptionContent', () => {
  it('returns false for empty marker', () => {
    expect(verseHasTranscriptionContent('\\v 11 ', '11')).toBe(false);
  });

  it('returns true when content follows marker', () => {
    expect(verseHasTranscriptionContent('\\v 11 text', '11')).toBe(true);
  });
});

describe('findEmptyVerseMarkerInsertIndex', () => {
  it('returns index after marker when empty', () => {
    expect(findEmptyVerseMarkerInsertIndex('\\v 11 \\v 12 ', '11')).toBe(6);
  });
});
