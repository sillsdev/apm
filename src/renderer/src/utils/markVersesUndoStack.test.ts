import {
  createMarkVersesUndoStack,
  MARK_VERSES_UNDO_MAX_DEPTH,
  type MarkVersesSnapshot,
} from './markVersesUndoStack';

const snap = (n: number): MarkVersesSnapshot => ({
  tableData: [[`${n}`]],
  segmentsJson: `{}${n}`,
  pastedSegments: '',
  waveSegmentsJson: '{}',
  currentSegment: '',
  currentSegmentIndex: -1,
});

describe('markVersesUndoStack', () => {
  it('pops in LIFO order', () => {
    const stack = createMarkVersesUndoStack();
    stack.push(snap(1));
    stack.push(snap(2));
    expect(stack.pop()?.segmentsJson).toBe('{}2');
    expect(stack.pop()?.segmentsJson).toBe('{}1');
    expect(stack.canUndo()).toBe(false);
  });

  it('caps depth', () => {
    const stack = createMarkVersesUndoStack();
    for (let i = 0; i < MARK_VERSES_UNDO_MAX_DEPTH + 5; i++) {
      stack.push(snap(i));
    }
    let count = 0;
    while (stack.canUndo()) {
      stack.pop();
      count += 1;
    }
    expect(count).toBe(MARK_VERSES_UNDO_MAX_DEPTH);
  });

  it('clear empties the stack', () => {
    const stack = createMarkVersesUndoStack();
    stack.push(snap(1));
    stack.clear();
    expect(stack.canUndo()).toBe(false);
  });
});
