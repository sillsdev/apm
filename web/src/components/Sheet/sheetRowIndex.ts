import { ISheet, SheetLevel } from '../../model';
import { isSectionRow } from './isSectionPassage';

/** Visible-row index among rows that are neither deleted nor filtered. */
export function getByIndex(
  ws: ISheet[],
  index: number
): { ws: ISheet | undefined; i: number } {
  let n = 0;
  let i = 0;
  while (i < ws.length) {
    if (!(ws[i] as ISheet).deleted && !(ws[i] as ISheet).filtered) {
      if (n === index) break;
      n += 1;
    }
    i += 1;
  }
  return { ws: i < ws.length ? ws[i] : undefined, i };
}

export function getUndelIndex(
  sheet: ISheet[],
  ix: number | undefined
): number | undefined {
  if (ix !== undefined) return getByIndex(sheet, ix).i;
  return ix;
}

export function findSection(
  myWorkflow: ISheet[],
  sectionIndex: number,
  before: boolean,
  skipPublishing: boolean
): number {
  while (
    sectionIndex >= 0 &&
    sectionIndex < myWorkflow.length &&
    ((myWorkflow[sectionIndex] as ISheet).deleted || skipPublishing
      ? (myWorkflow[sectionIndex] as ISheet).level !== SheetLevel.Section
      : !isSectionRow(myWorkflow[sectionIndex] as ISheet))
  ) {
    sectionIndex = sectionIndex + (before ? -1 : 1);
  }
  if (sectionIndex < 0 || sectionIndex === myWorkflow.length) return -1;
  return sectionIndex;
}

/** First non-deleted row that already has a book code. Scripture plans only. */
export function sheetFirstBook(sheet: ISheet[]): string {
  return sheet.find((b) => !b.deleted && (b.book ?? '') !== '')?.book ?? '';
}

/** Walk upward until `isSection(row)`, matching movement/section insert above. */
export function sectionRowAbove(
  start: number,
  isSection: (row: number) => boolean
): number {
  let row = start;
  while (!isSection(row)) row -= 1;
  return row;
}

/** Walk downward while the next row is a passage, matching add-passage-last. */
export function lastPassageRowBelow(
  start: number,
  isPassage: (row: number) => boolean
): number {
  let row = start;
  while (isPassage(row + 1)) row += 1;
  return row;
}
