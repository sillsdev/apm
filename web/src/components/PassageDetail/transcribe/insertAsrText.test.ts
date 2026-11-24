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
});
