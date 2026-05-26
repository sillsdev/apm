/** Undo stack for Mark Verses mobile (table + segments + selection). */

export const MARK_VERSES_UNDO_MAX_DEPTH = 20;

export interface MarkVersesSnapshot {
  tableData: unknown[][];
  segmentsJson: string;
  pastedSegments: string;
  waveSegmentsJson: string;
  currentSegment: string;
  currentSegmentIndex: number;
}

export interface MarkVersesUndoStack {
  push: (snapshot: MarkVersesSnapshot) => void;
  pop: () => MarkVersesSnapshot | undefined;
  canUndo: () => boolean;
  clear: () => void;
}

export const createMarkVersesUndoStack = (): MarkVersesUndoStack => {
  const stack: MarkVersesSnapshot[] = [];
  return {
    push(snapshot) {
      stack.push(snapshot);
      if (stack.length > MARK_VERSES_UNDO_MAX_DEPTH) {
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
