import { describe, expect, it } from '@jest/globals';
import { insertAsrText } from './insertAsrText';

describe('insertAsrText', () => {
  it('inserts at the caret with a space on each side', () => {
    expect(insertAsrText('one three', 'two', 3, 3)).toEqual({
      value: 'one two three',
      caret: 7,
    });
  });

  it('adds no extra space where the caret already has one', () => {
    expect(insertAsrText('one  three', 'two', 4, 4)).toEqual({
      value: 'one two three',
      caret: 7,
    });
  });

  it('adds at the end when the caret is at the start with no selection', () => {
    expect(insertAsrText('one', 'two', 0, 0)).toEqual({
      value: 'one two',
      caret: 7,
    });
  });

  it('adds at the end of the text', () => {
    expect(insertAsrText('one ', 'two', 4, 4)).toEqual({
      value: 'one two',
      caret: 7,
    });
  });

  it('replaces the selected text', () => {
    expect(insertAsrText('one XX three', 'two', 4, 6)).toEqual({
      value: 'one two three',
      caret: 7,
    });
  });

  it('inserts into an empty pane without padding', () => {
    expect(insertAsrText('', 'two', 0, 0)).toEqual({ value: 'two', caret: 3 });
  });
});
