import {
  isAddBlockedByRecording,
  isRemoveBlockedByRecording,
} from './segmentBoundaryLocks';
import { IRegion } from '../crud/useWavesurferRegions';

/**
 * The +/- segment controls must be disabled — not merely inert — over a
 * recorded segment (TT-7666). These are the pure predicates the player uses to
 * decide that; the UI feeds them the playhead position and the segment map.
 */

// three contiguous 10s segments
const regions: IRegion[] = [
  { start: 0, end: 10 },
  { start: 10, end: 20 },
  { start: 20, end: 30 },
];

const TOL = 0.1;

describe('isAddBlockedByRecording — Add (+) over a recorded segment', () => {
  it('blocks when the playhead is inside a recorded segment', () => {
    const recorded = (i: number) => i === 1;
    // playhead at 15s is inside segment 1
    expect(isAddBlockedByRecording(15, regions, recorded)).toBe(true);
  });

  it('allows when the playhead is inside an unrecorded segment', () => {
    const recorded = (i: number) => i === 1;
    // playhead at 5s is inside segment 0
    expect(isAddBlockedByRecording(5, regions, recorded)).toBe(false);
  });

  it('allows when nothing is recorded', () => {
    expect(isAddBlockedByRecording(15, regions, () => false)).toBe(false);
  });

  it('allows when no recording predicate is supplied', () => {
    expect(isAddBlockedByRecording(15, regions, undefined)).toBe(false);
  });
});

describe('isRemoveBlockedByRecording — Remove (-) across a recorded boundary', () => {
  it('blocks at the join when the segment before it is recorded', () => {
    const recorded = (i: number) => i === 1;
    // join between segment 1 and 2 sits at 20s
    expect(isRemoveBlockedByRecording(20, regions, TOL, recorded)).toBe(true);
  });

  it('blocks at the join when the segment after it is recorded', () => {
    const recorded = (i: number) => i === 2;
    // join between segment 1 and 2 at 20s; segment 2 (after) is recorded
    expect(isRemoveBlockedByRecording(20, regions, TOL, recorded)).toBe(true);
  });

  it('allows at a join between two unrecorded segments', () => {
    const recorded = (i: number) => i === 2;
    // join between segment 0 and 1 at 10s; neither is recorded
    expect(isRemoveBlockedByRecording(10, regions, TOL, recorded)).toBe(false);
  });

  it('allows when the playhead is not near any join', () => {
    const recorded = (i: number) => i === 1;
    // 15s is mid-segment, not on a boundary
    expect(isRemoveBlockedByRecording(15, regions, TOL, recorded)).toBe(false);
  });
});
