import { describe, expect, it } from '@jest/globals';
import { appendAutoTranscription } from './appendAutoTranscription';

describe('appendAutoTranscription', () => {
  it('returns undefined when the cleaned text is already in the pane', () => {
    expect(appendAutoTranscription('hello', 'hello world')).toBeUndefined();
  });

  it('strips timestamp prefixes without clipping a longer digit run', () => {
    expect(appendAutoTranscription('0:01.200: hello 1:02.300: world', '')).toBe(
      ' hello world'
    );
    expect(appendAutoTranscription('12345678901:1.2: hi', '')).toBe(
      ' 12345678901:1.2: hi'
    );
  });

  it('skips a leading single-verse marker already in the pane', () => {
    expect(appendAutoTranscription('\\v 3 hello', '\\v 3 ')).toBe('hello');
  });

  // Pre-inserted range marker (Mark Verses → Transcribe) must not be half-stripped
  // into "1-5 -5" when ASR returns the same range plus later verses.
  it('keeps a verse-range marker intact when that range is already in the pane', () => {
    const added = appendAutoTranscription(
      '\\v 1-5 one two \\v 6-7 three',
      '\\v 1-5 '
    );
    expect(added).toBe('one two \\v 6-7 three');
    expect(added).not.toMatch(/-5/);
  });

  it('keeps a letter-suffix marker intact when already in the pane', () => {
    expect(appendAutoTranscription('\\v 1a hello', '\\v 1a ')).toBe('hello');
  });

  it('adds a leading space when the pane text does not end with one', () => {
    expect(appendAutoTranscription('more', 'hi')).toBe(' more');
  });

  it('adds no leading space when the pane text already ends with one', () => {
    expect(appendAutoTranscription('more', 'hi ')).toBe('more');
  });
});
