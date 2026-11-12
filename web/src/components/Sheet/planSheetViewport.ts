export function sheetToAbs(sheetI: number, windowFirst: number): number {
  return sheetI <= 0 ? sheetI : sheetI + windowFirst - 1;
}

export function absToSheet(absI: number, windowFirst: number): number {
  return absI <= 0 ? absI : absI - windowFirst + 1;
}

export interface WindowPin {
  edge: false | 'start' | 'end';
  desiredTop?: number;
}

/** Where the virtual window should sit so `row` is mounted. Does not recenter. */
export function pinWindowTarget(options: {
  row: number;
  windowFirst: number;
  windowLast: number;
  pageSize: number;
  dataLength: number;
}): WindowPin {
  const { row, windowFirst, windowLast, pageSize, dataLength } = options;
  if (row < 1) return { edge: false };
  if (row >= windowFirst && row < windowLast) return { edge: false };
  const desiredTop = Math.min(
    Math.max(1, dataLength - pageSize),
    row < windowFirst ? row : Math.max(1, row - pageSize + 1)
  );
  const edge = row < windowFirst ? 'start' : 'end';
  return { edge, desiredTop };
}

/** DataSheet row index for the current absolute row, or -1 when it is not mounted. */
export function sheetCurrentIndex(
  currentRow: number,
  windowFirst: number,
  windowLast: number
): number {
  if (currentRow === 0) return windowFirst === 1 ? 0 : -1;
  if (currentRow < windowFirst || currentRow >= windowLast) return -1;
  return currentRow - windowFirst + 1;
}

export interface SheetGridSelection {
  start: { i: number; j: number };
  end: { i: number; j: number };
}

export function visibleSheetSelection(options: {
  startI: number;
  endI: number;
  startJ: number;
  endJ: number;
  windowFirst: number;
  windowLast: number;
}): SheetGridSelection | null {
  const { startI, endI, startJ, endJ, windowFirst, windowLast } = options;
  if (endI < 0 && startI < 0) return null;
  if (startI === 0 && endI === 0) {
    return { start: { i: 0, j: startJ }, end: { i: 0, j: endJ } };
  }
  const lo = Math.min(startI, endI);
  const hi = Math.max(startI, endI);
  if (hi < windowFirst || lo >= windowLast) return null;
  const toSheet = (abs: number) => {
    if (abs <= 0) return 0;
    const clamped = Math.min(Math.max(abs, windowFirst), windowLast - 1);
    return clamped - windowFirst + 1;
  };
  return {
    // DataSheet treats `start` as the current cell (arrows, Enter, typing).
    start: { i: toSheet(endI), j: endJ },
    end: { i: toSheet(startI), j: startJ },
  };
}
