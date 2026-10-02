import { describe, expect, it } from '@jest/globals';
import {
  createPhraseSegmentUndoStack,
  PHRASE_SEGMENT_UNDO_MAX_DEPTH,
} from './phraseSegmentUndoStack';

describe('createPhraseSegmentUndoStack', () => {
  it('pushes and pops segment snapshots', () => {
    const stack = createPhraseSegmentUndoStack();
    expect(stack.canUndo()).toBe(false);
    stack.push('{"regions":[{"start":0,"end":1}]}');
    expect(stack.canUndo()).toBe(true);
    expect(stack.pop()).toBe('{"regions":[{"start":0,"end":1}]}');
    expect(stack.canUndo()).toBe(false);
  });

  it('caps depth and clears', () => {
    const stack = createPhraseSegmentUndoStack();
    for (let i = 0; i < PHRASE_SEGMENT_UNDO_MAX_DEPTH + 5; i++) {
      stack.push(`seg-${i}`);
    }
    expect(stack.pop()).toBe(`seg-${PHRASE_SEGMENT_UNDO_MAX_DEPTH + 4}`);
    stack.clear();
    expect(stack.canUndo()).toBe(false);
  });
});
