import type { ISTFilterState } from './filterMenu';

export function isSheetFilterActive(
  filterState: ISTFilterState,
  minimumSection: number,
  maximumSection: number
): boolean {
  return (
    !filterState.disabled &&
    (filterState.minStep !== '' ||
      filterState.maxStep !== '' ||
      filterState.hideDone ||
      filterState.minSection > minimumSection ||
      (filterState.maxSection > -1 &&
        filterState.maxSection < maximumSection) ||
      filterState.assignedToMe)
  );
}
