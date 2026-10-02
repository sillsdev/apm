import {
  canCombineWithNext,
  mergeClauseWithNext,
} from './carefulSpeechClauseMerge';
import { IRegion } from '../../../crud/useWavesurferRegions';

const regions: IRegion[] = [
  { start: 0, end: 10, label: 'a' },
  { start: 10, end: 20, label: 'b' },
  { start: 20, end: 30, label: 'c' },
];

describe('carefulSpeechClauseMerge', () => {
  it('canCombineWithNext is false on last clause', () => {
    expect(canCombineWithNext(2, regions, new Set())).toBe(false);
  });

  it('canCombineWithNext is false when either clause has a recording', () => {
    expect(canCombineWithNext(0, regions, new Set([0]))).toBe(false);
    expect(canCombineWithNext(0, regions, new Set([1]))).toBe(false);
  });

  it('canCombineWithNext is true for adjacent unrecorded clauses', () => {
    expect(canCombineWithNext(0, regions, new Set())).toBe(true);
  });

  it('mergeClauseWithNext extends end and removes next region', () => {
    const merged = mergeClauseWithNext(regions, 0);
    expect(merged).toHaveLength(2);
    expect(merged?.[0].end).toBe(20);
    expect(merged?.[0].start).toBe(0);
    expect(merged?.[1].start).toBe(20);
  });

  it('mergeClauseWithNext returns undefined for invalid index', () => {
    expect(mergeClauseWithNext(regions, 2)).toBeUndefined();
    expect(mergeClauseWithNext(regions, -1)).toBeUndefined();
  });
});
