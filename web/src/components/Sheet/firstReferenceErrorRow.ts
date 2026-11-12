export function firstReferenceErrorRow(options: {
  rowData: Array<Array<string | number>>;
  bookCol: number;
  refCol: number;
  isPassage: (rowIndex: number) => boolean;
  hasRefError: (cell: string | number) => boolean;
}): number | undefined {
  const { rowData, bookCol, refCol, isPassage, hasRefError } = options;
  let firstErrRow: number | undefined;
  if (refCol > 0) {
    rowData.forEach((row, rowIndex) => {
      if (isPassage(rowIndex)) {
        const hasRefErr = hasRefError(row[refCol]);
        const missingBook = !row[bookCol];
        if (hasRefErr || missingBook) {
          if (firstErrRow === undefined) firstErrRow = rowIndex + 1;
        }
      }
    });
  }
  return firstErrRow;
}
