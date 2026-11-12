import type { ISTFilterState } from './filterMenu';
import { isSheetFilterActive } from './isSheetFilterActive';

const idle: ISTFilterState = {
  minStep: '',
  maxStep: '',
  minSection: 1,
  maxSection: -1,
  assignedToMe: false,
  hideDone: false,
  disabled: false,
  canHideDone: true,
};

describe('isSheetFilterActive', () => {
  it('is inactive when every bound is at its default', () => {
    expect(isSheetFilterActive(idle, 1, 10)).toBe(false);
  });

  it('is inactive while the filter is disabled', () => {
    expect(
      isSheetFilterActive({ ...idle, disabled: true, hideDone: true }, 1, 10)
    ).toBe(false);
  });

  it('is active for each flag on its own', () => {
    expect(isSheetFilterActive({ ...idle, minStep: 'step-1' }, 1, 10)).toBe(
      true
    );
    expect(isSheetFilterActive({ ...idle, maxStep: 'step-2' }, 1, 10)).toBe(
      true
    );
    expect(isSheetFilterActive({ ...idle, hideDone: true }, 1, 10)).toBe(true);
    expect(isSheetFilterActive({ ...idle, assignedToMe: true }, 1, 10)).toBe(
      true
    );
  });

  it('treats minSection equal to the minimum as inactive', () => {
    expect(isSheetFilterActive({ ...idle, minSection: 1 }, 1, 10)).toBe(false);
    expect(isSheetFilterActive({ ...idle, minSection: 2 }, 1, 10)).toBe(true);
  });

  it('treats maxSection equal to the maximum, or unset, as inactive', () => {
    expect(isSheetFilterActive({ ...idle, maxSection: -1 }, 1, 10)).toBe(false);
    expect(isSheetFilterActive({ ...idle, maxSection: 10 }, 1, 10)).toBe(false);
    expect(isSheetFilterActive({ ...idle, maxSection: 4 }, 1, 10)).toBe(true);
  });
});
