import { IRegion } from '../../../crud/useWavesurferRegions';
import { findClauseSplitPoint } from '../../../utils/clauseSplitSilence';

export { findClauseSplitPoint };

export function canSplitClause(
  index: number,
  regions: IRegion[],
  completedIndices: Set<number>,
  splitPoint: number | undefined
): boolean {
  if (index < 0 || index >= regions.length) return false;
  if (completedIndices.has(index)) return false;
  return splitPoint !== undefined;
}

export function splitClauseAt(
  regions: IRegion[],
  index: number,
  splitPoint: number
): IRegion[] | undefined {
  if (index < 0 || index >= regions.length) return undefined;
  const current = regions[index];
  if (!current || splitPoint <= current.start || splitPoint >= current.end) {
    return undefined;
  }

  const first: IRegion = {
    ...current,
    end: splitPoint,
    label: current.label ?? '',
  };
  const second: IRegion = {
    start: splitPoint,
    end: current.end,
    label: '',
  };

  const updated = [...regions];
  updated.splice(index, 1, first, second);
  return updated;
}
