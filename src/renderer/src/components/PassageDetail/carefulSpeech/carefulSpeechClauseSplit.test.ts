import { canSplitClause, splitClauseAt } from './carefulSpeechClauseSplit';
import { IRegion } from '../../../crud/useWavesurferRegions';

const regions: IRegion[] = [
  { start: 0, end: 10, label: 'a' },
  { start: 10, end: 20, label: 'b' },
];

describe('carefulSpeechClauseSplit', () => {
  it('canSplitClause is false when clause has a recording', () => {
    expect(canSplitClause(0, regions, new Set([0]), 5)).toBe(false);
  });

  it('canSplitClause is false without a valid split point', () => {
    expect(canSplitClause(0, regions, new Set(), undefined)).toBe(false);
  });

  it('canSplitClause is true for unrecorded clause with split point', () => {
    expect(canSplitClause(0, regions, new Set(), 5)).toBe(true);
  });

  it('splitClauseAt divides the clause at the split point', () => {
    const split = splitClauseAt(regions, 0, 4);
    expect(split).toHaveLength(3);
    expect(split?.[0]).toEqual({ start: 0, end: 4, label: 'a' });
    expect(split?.[1]).toEqual({ start: 4, end: 10, label: '' });
    expect(split?.[2].start).toBe(10);
  });

  it('splitClauseAt returns undefined for invalid split point', () => {
    expect(splitClauseAt(regions, 0, 0)).toBeUndefined();
    expect(splitClauseAt(regions, 0, 10)).toBeUndefined();
    expect(splitClauseAt(regions, -1, 5)).toBeUndefined();
  });
});
