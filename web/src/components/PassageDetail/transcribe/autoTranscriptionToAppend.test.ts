import { describe, expect, it } from '@jest/globals';
import { autoTranscriptionToAppend } from './autoTranscriptionToAppend';

describe('autoTranscriptionToAppend', () => {
  it('returns undefined for empty input', () => {
    expect(autoTranscriptionToAppend('', 'hello')).toBeUndefined();
    expect(autoTranscriptionToAppend('   ', '')).toBeUndefined();
  });

  it('returns undefined when the cleaned text is already in the pane', () => {
    expect(autoTranscriptionToAppend('hello', 'hello world')).toBeUndefined();
  });

  it('strips timestamp prefixes without clipping a longer digit run', () => {
    expect(
      autoTranscriptionToAppend('0:01.200: hello 1:02.300: world', '')
    ).toBe(' hello world');
    expect(autoTranscriptionToAppend('12345678901:1.2: hi', '')).toBe(
      ' 12345678901:1.2: hi'
    );
  });

  it('skips a single-verse marker already in the pane', () => {
    expect(autoTranscriptionToAppend('\\v 3 hello', '\\v 3 ')).toBe('hello');
  });

  // Pre-inserted range marker (Mark Verses → Transcribe) must not be half-stripped
  // into "1-5 -5" when ASR returns the same range plus later verses.
  it('keeps a verse-range marker intact when that range is already in the pane', () => {
    const added = autoTranscriptionToAppend(
      '\\v 1-5 one two \\v 6-7 three',
      '\\v 1-5 '
    );
    expect(added).toBe('one two \\v 6-7 three');
    expect(added).not.toMatch(/-5/);
  });

  // Pane may end the marker with a newline instead of a space.
  it('does not duplicate a range marker when the pane has a newline after it', () => {
    const added = autoTranscriptionToAppend(
      '\\v 1-5 one two \\v 6-7 three',
      '\\v 1-5\n'
    );
    expect(added).toBe('one two \\v 6-7 three');
    expect(added).not.toMatch(/^\\v 1-5/);
  });

  it('keeps a letter-suffix marker intact when already in the pane', () => {
    expect(autoTranscriptionToAppend('\\v 1a hello', '\\v 1a ')).toBe('hello');
  });

  it('keeps a range ending in a letter-suffix intact when already in the pane', () => {
    expect(autoTranscriptionToAppend('\\v 1-5a hello world', '\\v 1-5a ')).toBe(
      'hello world'
    );
  });

  it('adds a leading space when the pane text does not end with one', () => {
    expect(autoTranscriptionToAppend('more', 'hi')).toBe(' more');
  });

  it('adds no leading space when the pane text already ends with one', () => {
    expect(autoTranscriptionToAppend('more', 'hi ')).toBe('more');
  });
});
