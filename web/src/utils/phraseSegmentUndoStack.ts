/** Multi-level undo for Phrase Back Translation segment boundaries. */

export const PHRASE_SEGMENT_UNDO_MAX_DEPTH = 20;

export interface PhraseSegmentUndoStack {
  push: (segmentsJson: string) => void;
  pop: () => string | undefined;
  canUndo: () => boolean;
  clear: () => void;
}

/**
 * Plain LIFO stack.
 * Multi-fire from one boundary gesture (TT-7437) is collapsed in the consumer
 * before push: handleSegment compares incoming boundaries against the live
 * segmentation ref and returns early when unchanged, so a second onSegment
 * event never reaches push. See PassageDetailGuidedPhraseRecord.
 */
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
    canUndo: () => stack.length > 0,
    clear: () => {
      stack.length = 0;
    },
  };
};
