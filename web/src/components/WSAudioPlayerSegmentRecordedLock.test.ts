import {
  isAddBlockedByRecording,
  isRemoveBlockedByRecording,
} from './segmentBoundaryLocks';
import { IRegion } from '../crud/useWavesurferRegions';

/**
 * Tests for +/- blocking rules on recorded segments (TT-7666).
 */

// Three contiguous 10-second segments.
const regions: IRegion[] = [
  { start: 0, end: 10 },
  { start: 10, end: 20 },
  { start: 20, end: 30 },
];

const TOL = 0.1;

describe('isAddBlockedByRecording — Add (+) over a recorded segment', () => {
  it('blocks when the playhead is inside a recorded segment', () => {
    const recorded = (i: number) => i === 1;
    // 15s is inside segment 1.
    expect(isAddBlockedByRecording(15, regions, recorded)).toBe(true);
  });

  it('allows when the playhead is inside an unrecorded segment', () => {
    const recorded = (i: number) => i === 1;
    // 5s is inside segment 0.
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
    // Join between segment 1 and 2 is at 20s.
    expect(isRemoveBlockedByRecording(20, regions, TOL, recorded)).toBe(true);
  });

  it('blocks at the join when the segment after it is recorded', () => {
    const recorded = (i: number) => i === 2;
    // At join 20s, segment 2 (after) is recorded.
    expect(isRemoveBlockedByRecording(20, regions, TOL, recorded)).toBe(true);
  });

  it('allows at a join between two unrecorded segments', () => {
    const recorded = (i: number) => i === 2;
    // At join 10s, neither side is recorded.
    expect(isRemoveBlockedByRecording(10, regions, TOL, recorded)).toBe(false);
  });

  it('allows when the playhead is not near any join', () => {
    const recorded = (i: number) => i === 1;
    // 15s is not near a boundary.
    expect(isRemoveBlockedByRecording(15, regions, TOL, recorded)).toBe(false);
  });
});
