import { describe, expect, it } from '@jest/globals';
import { applyAsrText, insertAsrText } from './insertAsrText';

describe('insertAsrText', () => {
  it('inserts at the caret with a space on each side', () => {
    expect(insertAsrText('one three', 'two', { start: 3, end: 3 })).toEqual({
      value: 'one two three',
      caret: 7,
    });
  });

  it('adds no extra space where the caret already has one', () => {
    expect(insertAsrText('one  three', 'two', { start: 4, end: 4 })).toEqual({
      value: 'one two three',
      caret: 7,
    });
  });

  it('adds at the end when the caret is at the start with no selection', () => {
    expect(insertAsrText('one', 'two', { start: 0, end: 0 })).toEqual({
      value: 'one two',
      caret: 7,
    });
  });

  it('adds at the end of the text', () => {
    expect(insertAsrText('one ', 'two', { start: 4, end: 4 })).toEqual({
      value: 'one two',
      caret: 7,
    });
  });

  it('replaces the selected text', () => {
    expect(insertAsrText('one XX three', 'two', { start: 4, end: 6 })).toEqual({
      value: 'one two three',
      caret: 7,
    });
  });

  it('inserts into an empty pane without padding', () => {
    expect(insertAsrText('', 'two', { start: 0, end: 0 })).toEqual({
      value: 'two',
      caret: 3,
    });
  });
});

describe('applyAsrText', () => {
  const caret = { start: 3, end: 3 };

  it('replaces the whole pane', () => {
    expect(applyAsrText('one three', 'two', 'replace', caret)).toEqual({
      value: 'two',
      caret: 3,
    });
  });

  it('adds at the end, ignoring the caret', () => {
    expect(applyAsrText('one', ' two', 'end', { start: 1, end: 1 })).toEqual({
      value: 'one two',
      caret: 7,
    });
  });

  it('inserts at the caret', () => {
    expect(applyAsrText('one three', 'two', 'cursor', caret)).toEqual({
      value: 'one two three',
      caret: 7,
    });
  });

  // TT-7856: Insert fills an empty marker instead of adding a second one.
  describe('with empty verse markers in the pane', () => {
    const pane = '\\v 1 Existing words \\v 2 ';
    const markers = (value: string, verse: string) =>
      value.split(String.raw`\v ${verse} `).length - 1;

    it('fills an empty marker at the caret', () => {
      const end = { start: pane.length, end: pane.length };
      const { value } = applyAsrText(pane, '\\v 2 New words', 'cursor', end);
      expect(value).toBe('\\v 1 Existing words \\v 2 New words ');
      expect(markers(value, '2')).toBe(1);
    });

    it('fills an empty marker away from the caret', () => {
      const afterExisting = { start: 14, end: 14 };
      const { value } = applyAsrText(
        pane,
        '\\v 2 New words',
        'cursor',
        afterExisting
      );
      expect(value).toBe('\\v 1 Existing words \\v 2 New words ');
    });

    it('fills an empty marker followed by another verse', () => {
      const { value } = applyAsrText('\\v 1 \\v 2 two', '\\v 1 one', 'cursor', {
        start: 0,
        end: 0,
      });
      expect(value).toBe('\\v 1 one \\v 2 two');
    });

    it('fills an empty marker before a newline and keeps the newline', () => {
      const { value } = applyAsrText(
        '\\v 1\n\\v 2 two',
        '\\v 1 one',
        'cursor',
        { start: 0, end: 0 }
      );
      expect(value).toBe('\\v 1 one\n\\v 2 two');
    });

    it('does not fill a different verse with the same leading digit', () => {
      const { value } = applyAsrText(
        '\\v 12 twelve \\v 1 ',
        '\\v 1 one',
        'cursor',
        { start: 0, end: 0 }
      );
      expect(value).toBe('\\v 12 twelve \\v 1 one ');
    });

    it('fills a suffixed marker', () => {
      const { value } = applyAsrText('\\v 1-5a ', '\\v 1-5a words', 'cursor', {
        start: 0,
        end: 0,
      });
      expect(value).toBe('\\v 1-5a words ');
    });

    it('fills what it can and inserts the rest at the caret', () => {
      const { value, caret: at } = applyAsrText(
        pane,
        '\\v 2 New words \\v 3 Three',
        'cursor',
        { start: pane.length, end: pane.length }
      );
      expect(value).toBe('\\v 1 Existing words \\v 2 New words \\v 3 Three');
      expect(markers(value, '2')).toBe(1);
      expect(at).toBe(value.length);
    });

    it('inserts the rest at a caret before the filled marker', () => {
      const { value } = applyAsrText(
        '\\v 1 one \\v 3 ',
        '\\v 2 two \\v 3 three',
        'cursor',
        { start: 9, end: 9 }
      );
      expect(value).toBe('\\v 1 one \\v 2 two \\v 3 three ');
    });

    it('keeps selected words when every part fills a marker', () => {
      const words = pane.indexOf('Existing');
      const { value } = applyAsrText(pane, '\\v 2 New words', 'cursor', {
        start: words,
        end: words + 'Existing words'.length,
      });
      expect(value).toContain('Existing words');
      expect(value).toBe('\\v 1 Existing words \\v 2 New words ');
    });

    it('does not fill a marker that already has words', () => {
      const { value } = applyAsrText('\\v 1 old', '\\v 1 new', 'cursor', {
        start: 8,
        end: 8,
      });
      expect(value).toBe('\\v 1 old \\v 1 new');
    });
  });
});
