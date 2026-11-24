/**
 * Put ASR text into the pane at the caret (or over the selection), with a
 * space between it and any word on either side. A caret at 0 with no
 * selection means "not placed", so the text goes at the end, as with
 * insertAtCursor. Returns the new value and the caret after the insert.
 */
export function insertAsrText(
  current: string,
  text: string,
  start: number,
  end: number
): { value: string; caret: number } {
  const atEnd = start === 0 && end === 0;
  const from = atEnd ? current.length : start;
  const to = atEnd ? current.length : end;
  const before = current.slice(0, from);
  const after = current.slice(to);
  const lead = before && !/\s$/.test(before) ? ' ' : '';
  const trail = after && !/^\s/.test(after) ? ' ' : '';
  const inserted = lead + text + trail;
  return {
    value: before + inserted + after,
    caret: before.length + lead.length + text.length,
  };
}
