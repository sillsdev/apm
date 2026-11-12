import {
  absToSheet,
  pinWindowTarget,
  sheetCurrentIndex,
  sheetToAbs,
  visibleSheetSelection,
} from './planSheetViewport';
import { remapSheetCellChanges } from './remapSheetCellChanges';
import { sheetCopyRange, sheetCopyText } from './sheetCopyText';
import { firstReferenceErrorRow } from './firstReferenceErrorRow';

describe('plan sheet indexes', () => {
  it('leaves the header row at 0 and shifts data rows by the window', () => {
    expect(sheetToAbs(0, 5)).toBe(0);
    expect(sheetToAbs(1, 5)).toBe(5);
    expect(absToSheet(0, 5)).toBe(0);
    expect(absToSheet(5, 5)).toBe(1);
    expect(sheetToAbs(-1, 5)).toBe(-1);
  });

  it('does not move the window when the row is already mounted', () => {
    expect(
      pinWindowTarget({
        row: 3,
        windowFirst: 1,
        windowLast: 6,
        pageSize: 4,
        dataLength: 20,
      })
    ).toEqual({ edge: false });
  });

  it('pins a row above the window to the start and a row below to the end', () => {
    expect(
      pinWindowTarget({
        row: 2,
        windowFirst: 8,
        windowLast: 12,
        pageSize: 4,
        dataLength: 30,
      })
    ).toEqual({ edge: 'start', desiredTop: 2 });
    expect(
      pinWindowTarget({
        row: 20,
        windowFirst: 1,
        windowLast: 6,
        pageSize: 4,
        dataLength: 30,
      })
    ).toEqual({ edge: 'end', desiredTop: 17 });
  });

  it('returns no edge for a header or an empty target', () => {
    expect(
      pinWindowTarget({
        row: 0,
        windowFirst: 1,
        windowLast: 4,
        pageSize: 2,
        dataLength: 10,
      }).edge
    ).toBe(false);
  });

  it('maps the current row onto the mounted sheet, including a hidden header', () => {
    expect(sheetCurrentIndex(0, 1, 5)).toBe(0);
    expect(sheetCurrentIndex(0, 4, 8)).toBe(-1);
    expect(sheetCurrentIndex(6, 4, 8)).toBe(3);
    expect(sheetCurrentIndex(9, 4, 8)).toBe(-1);
  });

  it('clamps a selection into the mounted window', () => {
    expect(
      visibleSheetSelection({
        startI: -1,
        endI: -1,
        startJ: 0,
        endJ: 0,
        windowFirst: 1,
        windowLast: 5,
      })
    ).toBeNull();
    expect(
      visibleSheetSelection({
        startI: 0,
        endI: 0,
        startJ: 1,
        endJ: 2,
        windowFirst: 4,
        windowLast: 8,
      })
    ).toEqual({ start: { i: 0, j: 1 }, end: { i: 0, j: 2 } });
    expect(
      visibleSheetSelection({
        startI: 1,
        endI: 2,
        startJ: 0,
        endJ: 1,
        windowFirst: 5,
        windowLast: 9,
      })
    ).toBeNull();
    expect(
      visibleSheetSelection({
        startI: 6,
        endI: 10,
        startJ: 1,
        endJ: 3,
        windowFirst: 5,
        windowLast: 9,
      })
    ).toEqual({ start: { i: 4, j: 3 }, end: { i: 2, j: 1 } });
  });
});

describe('remapSheetCellChanges', () => {
  const change = { cell: null, row: 1, col: 6, value: 'x' };

  it('subtracts the prefix columns when publishing is hidden', () => {
    expect(
      remapSheetCellChanges([change], {
        windowFirst: 1,
        prefixedCols: 3,
        hidePublishing: true,
        publishingOn: true,
      })
    ).toEqual([{ cell: null, row: 0, col: 3, value: 'x' }]);
  });

  it('also subtracts the publishing column when it is shown', () => {
    expect(
      remapSheetCellChanges([change], {
        windowFirst: 4,
        prefixedCols: 4,
        hidePublishing: false,
        publishingOn: true,
      })
    ).toEqual([{ cell: null, row: 3, col: 1, value: 'x' }]);
  });
});

describe('sheetCopyText', () => {
  const rows: Array<Array<string | number>> = [
    [1, 's', '(move)', 'LUK'],
    [0, 'p', '1:1', 'LUK'],
    [2, 't', 'keep', 'JHN'],
  ];

  it('blanks a parenthetical third column when the first cell is set', () => {
    expect(sheetCopyText(rows, 0, 3)).toBe(
      '1\ts\t\tLUK\n0\tp\t1:1\tLUK\n2\tt\tkeep\tJHN\n'
    );
  });

  it('uses the drag range when the anchor and the current row differ', () => {
    expect(sheetCopyRange(undefined, undefined, 10, 2, 4)).toEqual({
      start: 1,
      end: 4,
    });
    expect(sheetCopyRange(1, 2, 10, 3, 3)).toEqual({ start: 1, end: 2 });
    expect(sheetCopyRange(undefined, undefined, 10, -1, 4)).toEqual({
      start: 0,
      end: 10,
    });
  });
});

describe('firstReferenceErrorRow', () => {
  const rows: Array<Array<string | number>> = [
    [1, 'LUK', '1:1'],
    [2, '', 'bad'],
    [3, 'JHN', 'also bad'],
  ];
  const isPassage = (i: number) => i > 0;

  it('returns undefined when the sheet is clean or the reference column is missing', () => {
    expect(
      firstReferenceErrorRow({
        rowData: rows,
        bookCol: 1,
        refCol: 0,
        isPassage,
        hasRefError: () => true,
      })
    ).toBeUndefined();
    expect(
      firstReferenceErrorRow({
        rowData: [[1, 'LUK', '1:1']],
        bookCol: 1,
        refCol: 2,
        isPassage: () => true,
        hasRefError: () => false,
      })
    ).toBeUndefined();
  });

  it('returns the first passage row with a bad reference or a missing book', () => {
    expect(
      firstReferenceErrorRow({
        rowData: rows,
        bookCol: 1,
        refCol: 2,
        isPassage,
        hasRefError: (cell) => cell === 'bad' || cell === 'also bad',
      })
    ).toBe(2);
    expect(
      firstReferenceErrorRow({
        rowData: [
          [1, 'LUK', '1:1'],
          [2, '', '1:2'],
        ],
        bookCol: 1,
        refCol: 2,
        isPassage: () => true,
        hasRefError: () => false,
      })
    ).toBe(2);
  });
});
