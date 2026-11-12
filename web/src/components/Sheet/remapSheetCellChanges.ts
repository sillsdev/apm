import { sheetToAbs } from './planSheetViewport';

export function remapSheetCellChanges<T extends { row: number; col: number }>(
  changes: T[],
  options: {
    windowFirst: number;
    prefixedCols: number;
    hidePublishing: boolean;
    publishingOn: boolean;
  }
): T[] {
  const { windowFirst, prefixedCols, hidePublishing, publishingOn } = options;
  return changes.map((c) => ({
    ...c,
    row: sheetToAbs(c.row, windowFirst) - 1,
    col:
      !hidePublishing && publishingOn
        ? c.col - prefixedCols - 1
        : c.col - prefixedCols,
  }));
}
