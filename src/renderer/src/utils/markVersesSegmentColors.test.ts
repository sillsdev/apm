import {
  createMarkVersesApplyRegionColor,
  getMarkVersesRegionBaseColor,
  isMarkVersesRowCompleted,
  isMarkVersesTableRowCompleted,
  isMarkVersesTableTailIncomplete,
  MARK_VERSES_COMPLETED_RGBA,
  MARK_VERSES_CURRENT_RGBA,
  MARK_VERSES_UNMARKED_RGBA,
} from './markVersesSegmentColors';

const has = (limits: (string | undefined)[]) => (rowIndex: number) =>
  Boolean(limits[rowIndex]?.trim());

describe('markVersesSegmentColors', () => {
  it('treats last row with limits as incomplete when later rows lack limits', () => {
    const limits = ['', '0:00-0:05', '0:05-0:34', '', '', ''];
    const rowHas = has(limits);
    expect(isMarkVersesRowCompleted(rowHas, 1, limits.length)).toBe(true);
    expect(isMarkVersesRowCompleted(rowHas, 2, limits.length)).toBe(false);
  });

  it('marks earlier rows complete when a later row still spans the open tail', () => {
    const limits = ['', '0:00-0:10', '0:10-0:20', '0:20-1:09', ''];
    const rowHas = has(limits);
    expect(isMarkVersesRowCompleted(rowHas, 1, limits.length)).toBe(true);
    expect(isMarkVersesRowCompleted(rowHas, 2, limits.length)).toBe(true);
    expect(isMarkVersesRowCompleted(rowHas, 3, limits.length)).toBe(false);
  });

  it('marks all rows complete when every verse has limits', () => {
    const limits = ['', '0:00-0:10', '0:10-0:20', '0:20-1:09'];
    const rowHas = has(limits);
    expect(isMarkVersesRowCompleted(rowHas, 3, limits.length)).toBe(true);
    expect(
      isMarkVersesTableTailIncomplete(limits.map((value) => [{ value }]))
    ).toBe(false);
  });

  it('uses unmarked color for the last waveform region while tail is open', () => {
    expect(getMarkVersesRegionBaseColor(1, 2, true)).toBe(
      MARK_VERSES_UNMARKED_RGBA
    );
    expect(getMarkVersesRegionBaseColor(0, 2, true)).toBe(
      MARK_VERSES_COMPLETED_RGBA
    );
    expect(getMarkVersesRegionBaseColor(1, 2, false)).toBe(
      MARK_VERSES_COMPLETED_RGBA
    );
  });

  it('reads completion from table rows', () => {
    const table = [
      [{ value: 'Start-Stop' }],
      [{ value: '0:00-0:05' }],
      [{ value: '0:05-0:34' }],
      [{ value: '' }],
    ];
    expect(isMarkVersesTableRowCompleted(table, 1)).toBe(true);
    expect(isMarkVersesTableRowCompleted(table, 2)).toBe(false);
    expect(isMarkVersesTableTailIncomplete(table)).toBe(true);
  });

  it('createMarkVersesApplyRegionColor maps roles to region colors', () => {
    const tailOpenRef = { current: true };
    const apply = createMarkVersesApplyRegionColor(tailOpenRef);
    expect(apply('current', 0, 2)).toBe(MARK_VERSES_CURRENT_RGBA);
    expect(apply('new', 0, 2)).toBe(MARK_VERSES_UNMARKED_RGBA);
    expect(apply('base', 1, 2)).toBe(MARK_VERSES_UNMARKED_RGBA);
    expect(apply('base', 0, 2)).toBe(MARK_VERSES_COMPLETED_RGBA);

    tailOpenRef.current = false;
    expect(apply('new', 0, 2)).toBe(MARK_VERSES_COMPLETED_RGBA);
    expect(apply('base', 1, 2)).toBe(MARK_VERSES_COMPLETED_RGBA);
  });
});
