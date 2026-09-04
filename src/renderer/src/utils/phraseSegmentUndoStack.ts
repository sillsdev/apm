/** Multi-level undo for Phrase Back Translation segment boundaries. */

export const PHRASE_SEGMENT_UNDO_MAX_DEPTH = 20;

export interface PhraseSegmentUndoStack {
  push: (segmentsJson: string) => void;
  pop: () => string | undefined;
  /** Most recently pushed snapshot without removing it (for dedupe). */
  peek: () => string | undefined;
  canUndo: () => boolean;
  clear: () => void;
}

export const createPhraseSegmentUndoStack = (): PhraseSegmentUndoStack => {
  const stack: string[] = [];
  return {
    push(segmentsJson) {
      stack.push(segmentsJson);
      if (stack.length > PHRASE_SEGMENT_UNDO_MAX_DEPTH) {
        stack.shift();
      }
    },
    pop() {
      return stack.pop();
    },
    peek: () => stack[stack.length - 1],
    canUndo: () => stack.length > 0,
    clear: () => {
      stack.length = 0;
    },
  };
};
