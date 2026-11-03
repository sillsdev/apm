import { sheetCellKindReadOnly } from './sheetCellKindReadOnly';

describe('sheetCellKindReadOnly', () => {
  it('leaves every column editable when passages are inline', () => {
    expect(sheetCellKindReadOnly(true, true, true, 0)).toBe(false);
    expect(sheetCellKindReadOnly(true, false, true, 4)).toBe(false);
  });

  it('locks the title side of a passage row', () => {
    expect(sheetCellKindReadOnly(false, true, true, 1)).toBe(true);
    expect(sheetCellKindReadOnly(false, true, false, 2)).toBe(false);
  });

  it('locks columns after the title on a section row', () => {
    expect(sheetCellKindReadOnly(false, false, true, 1)).toBe(false);
    expect(sheetCellKindReadOnly(false, false, true, 2)).toBe(true);
  });

  it('locks the title side of any other row', () => {
    expect(sheetCellKindReadOnly(false, false, false, 1)).toBe(true);
    expect(sheetCellKindReadOnly(false, false, false, 2)).toBe(false);
  });
});
