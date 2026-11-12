export function sheetCopyRange(
  start: number | undefined,
  end: number | undefined,
  rowCount: number,
  startRow: number,
  currentRow: number
): { start: number; end: number } {
  let nextStart = start ?? 0;
  let nextEnd = end ?? rowCount;
  if (startRow !== -1 && startRow !== currentRow) {
    nextStart = startRow - 1;
    nextEnd = currentRow;
  }
  return { start: nextStart, end: nextEnd };
}

export function sheetCopyText(
  rowData: Array<Array<string | number>>,
  start: number,
  end: number
): string {
  let content = '';
  for (let idx = start; idx < end; idx++) {
    const row = [...rowData[idx]];
    if (Boolean(row[0]) && (row[2] as string).startsWith('(')) row[2] = '';
    content += row.join('\t') + '\n';
  }
  return content;
}
