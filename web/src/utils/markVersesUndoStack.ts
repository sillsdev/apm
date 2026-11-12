/** Undo stack for Mark Verses mobile (table + segments + selection).
 *
 * Plain LIFO, with no value-based dedupe. Mark Verses snapshots include boundary
 * edits plus reference/table edits, so two snapshots with the same segments may
 * still represent different user actions and must both be kept.
 *
 * TT-7437 multi-fire handling (one boundary gesture producing several onSegment
 * events) is enforced in the consumer, which only pushes when region count
 * changes. See prevRegionCountRef in PassageDetailMarkVerses.
 *
 * TT-7437 stale-closure handling also lives in the consumer, where snapshots
 * are built from live refs.
 */

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
