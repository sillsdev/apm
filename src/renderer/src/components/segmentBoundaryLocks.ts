import { IRegion } from '../crud/useWavesurferRegions';

/**
 * Helpers for disabling +/- when a recorded segment would be changed
 * (TT-7666). Kept separate for easier unit testing.
 */

/** Sorted index of the segment at the playhead, or -1. */
export function segmentIndexAtProgress(
  progressSec: number,
  regions: IRegion[]
): number {
  const sorted = [...regions].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length; i++) {
    const isLast = i === sorted.length - 1;
    if (
      progressSec >= sorted[i].start &&
      (isLast ? progressSec <= sorted[i].end : progressSec < sorted[i].end)
    ) {
      return i;
    }
  }
  return -1;
}

/** Block Add when it would split a recorded segment (TT-7666). */
export function isAddBlockedByRecording(
  progressSec: number,
  regions: IRegion[],
  isSegmentRecorded?: (index: number) => boolean
): boolean {
  if (!isSegmentRecorded) return false;
  const idx = segmentIndexAtProgress(progressSec, regions);
  return idx >= 0 && isSegmentRecorded(idx);
}

/** Block Remove when either side of the merged boundary is recorded (TT-7666). */
export function isRemoveBlockedByRecording(
  progressSec: number,
  regions: IRegion[],
  tol: number,
  isSegmentRecorded?: (index: number) => boolean
): boolean {
  if (!isSegmentRecorded || regions.length < 2) return false;
  const sorted = [...regions].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length - 1; i++) {
    if (Math.abs(progressSec - sorted[i].end) <= tol) {
      return isSegmentRecorded(i) || isSegmentRecorded(i + 1);
    }
  }
  return false;
}
