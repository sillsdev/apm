import { IRegion } from '../../../crud/useWavesurferRegions';

export function canCombineWithNext(
  index: number,
  regions: IRegion[],
  completedIndices: Set<number>
): boolean {
  if (index < 0 || index >= regions.length - 1) return false;
  if (completedIndices.has(index) || completedIndices.has(index + 1)) {
    return false;
  }
  return true;
}

export function mergeClauseWithNext(
  regions: IRegion[],
  index: number
): IRegion[] | undefined {
  if (index < 0 || index >= regions.length - 1) return undefined;
  const current = regions[index];
  const next = regions[index + 1];
  if (!current || !next) return undefined;

  const merged: IRegion = {
    ...current,
    end: next.end,
    label: current.label ?? '',
  };

  const updated = [...regions];
  updated[index] = merged;
  updated.splice(index + 1, 1);
  return updated;
}
