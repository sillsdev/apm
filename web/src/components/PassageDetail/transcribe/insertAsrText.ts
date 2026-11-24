import {
  resolveSelection,
  type TextSelection,
} from '../../../utils/insertAtCursor';

/** Where ASR text goes: replace the pane, add at the end, or at the caret. */
export type AsrTextMode = 'replace' | 'end' | 'cursor';

/** The pane's new value and the caret after the change. */
export interface AsrTextEdit {
  value: string;
  caret: number;
}

/**
 * Put ASR text into the pane at the caret (or over the selection), with a
 * space between it and any word on either side. An unplaced caret puts it at
 * the end (see resolveSelection).
 */
export function insertAsrText(
  current: string,
  text: string,
  selection: TextSelection
): AsrTextEdit {
  const { start, end } = resolveSelection(current.length, selection);
  const before = current.slice(0, start);
  const after = current.slice(end);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const trail = after && !/^\s/.test(after) ? ' ' : '';
  return {
    value: before + lead + text + trail + after,
    caret: before.length + lead.length + text.length,
  };
}

/** Apply ASR text to the pane in the given mode; shared by desktop and mobile. */
export function applyAsrText(
  current: string,
  text: string,
  mode: AsrTextMode,
  selection: TextSelection
): AsrTextEdit {
  switch (mode) {
    case 'replace':
      return { value: text, caret: text.length };
    case 'end':
      return { value: current + text, caret: current.length + text.length };
    case 'cursor':
      return insertAsrText(current, text, selection);
  }
}
