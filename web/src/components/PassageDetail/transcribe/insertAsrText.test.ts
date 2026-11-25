import { describe, expect, it } from '@jest/globals';
import {
  applyAsrText,
  insertAsrText,
  withoutFilledVerses,
} from './insertAsrText';

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
    expect(applyAsrText('one', 'two', 'end', { start: 1, end: 1 })).toEqual({
      value: 'one two',
      caret: 7,
    });
  });

  // TT-7856: a pane of empty markers gets each verse's words after its own
  // marker, not all of them after the last marker.
  describe('end onto empty verse markers', () => {
    const end = (pane: string, text: string) =>
      applyAsrText(pane, text, 'end', { start: 0, end: 0 }).value;
    const markers = (value: string, verse: string) =>
      value.match(new RegExp(String.raw`\\v ${verse}(?![\w-])`, 'g'))?.length ??
      0;

    it('fills each marker, one with a suffix', () => {
      const value = end('\\v 1a\n\\v 2', '\\v 1a one \\v 2 two');
      expect(value).toBe('\\v 1a one\n\\v 2 two');
      expect(markers(value, '1a')).toBe(1);
      expect(markers(value, '2')).toBe(1);
    });

    it('fills a lone marker', () => {
      expect(end('\\v 3 ', '\\v 3 hello')).toBe('\\v 3 hello ');
    });

    it('fills a range marker and adds later verses after it', () => {
      expect(end('\\v 1-5 ', '\\v 1-5 one two \\v 6-7 three')).toBe(
        '\\v 1-5 one two \\v 6-7 three'
      );
    });

    it('fills a range marker followed by a newline', () => {
      expect(end('\\v 1-5\n', '\\v 1-5 one two \\v 6-7 three')).toBe(
        '\\v 1-5 one two\n\\v 6-7 three'
      );
    });

    it('fills a range ending in a letter suffix', () => {
      expect(end('\\v 1-5a ', '\\v 1-5a hello world')).toBe(
        '\\v 1-5a hello world '
      );
    });

    it('adds text with no marker into an empty pane as is', () => {
      expect(end('', 'hello')).toBe('hello');
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

// TT-7856: Insert leaves out verses the pane already has words for, judged
// against the pane when Insert is chosen.
describe('withoutFilledVerses', () => {
  it('leaves out a verse with words in the pane', () => {
    expect(withoutFilledVerses('\\v 1 one \\v 2 two', '\\v 1 old')).toBe(
      '\\v 2 two'
    );
  });

  it('keeps a verse whose marker in the pane is empty', () => {
    expect(withoutFilledVerses('\\v 1 one \\v 2 two', '\\v 1 old \\v 2 ')).toBe(
      '\\v 2 two'
    );
    expect(withoutFilledVerses('\\v 1 one \\v 2 two', '\\v 1\n\\v 2')).toBe(
      '\\v 1 one \\v 2 two'
    );
  });

  it('tells a suffixed verse from the plain one', () => {
    expect(withoutFilledVerses('\\v 1a one \\v 1b two', '\\v 1 old')).toBe(
      '\\v 1a one \\v 1b two'
    );
    expect(withoutFilledVerses('\\v 1a one \\v 1b two', '\\v 1a old')).toBe(
      '\\v 1b two'
    );
  });

  it('keeps text before the first marker', () => {
    expect(withoutFilledVerses('intro \\v 1 one', '\\v 1 old')).toBe('intro');
  });

  it('keeps text with no markers', () => {
    expect(withoutFilledVerses('hello', 'old words')).toBe('hello');
  });

  it('is empty when every verse has words', () => {
    expect(withoutFilledVerses('\\v 1 one', '\\v 1 old')).toBe('');
  });
});
