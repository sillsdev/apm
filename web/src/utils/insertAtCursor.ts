// See: https://stackoverflow.com/questions/11076975/insert-text-into-textarea-at-cursor-position-javascript

/** A textarea selection; start === end is a plain caret. */
export interface TextSelection {
  start: number;
  end: number;
}

/**
 * The one rule for where typed-in or generated text goes: a caret at 0 with
 * no range means "not placed" (e.g. right after focus), so it goes at the end.
 */
export function resolveSelection(
  length: number,
  { start, end }: TextSelection
): TextSelection {
  return !start && start === end
    ? { start: length, end: length }
    : { start, end };
}

export function insertAtCursor(
  myField: HTMLTextAreaElement,
  myValue: string
): void {
  const { start, end } = resolveSelection(myField.value.length, {
    start: myField.selectionStart,
    end: myField.selectionEnd,
  });
  myField.value =
    myField.value.substring(0, start) + myValue + myField.value.substring(end);
}

export default insertAtCursor;
