/** Whether this column is locked because of the row kind. */
export function sheetCellKindReadOnly(
  inlinePassages: boolean,
  passage: boolean,
  section: boolean,
  cellIndex: number
): boolean {
  if (inlinePassages) return false;
  if (passage) return cellIndex <= 1;
  if (section) return cellIndex > 1;
  return cellIndex <= 1;
}
