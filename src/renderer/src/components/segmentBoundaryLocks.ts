import { IRegion } from '../crud/useWavesurferRegions';

/**
 * Helpers for disabling +/- when a recorded segment would be changed
 * (TT-7666). Kept separate for easier unit testing.
 *
 * `regions` must already be sorted by start — callers pass the player's
 * `regionBounds` (built via getSortedRegions). These run on every `progress`
 * update, so they iterate the array directly rather than cloning and sorting.
 */

/** Sorted index of the segment at the playhead, or -1. Assumes sorted input. */
export function segmentIndexAtProgress(
  progressSec: number,
  regions: IRegion[]
): number {
  for (let i = 0; i < regions.length; i++) {
    const isLast = i === regions.length - 1;
    if (
      progressSec >= regions[i].start &&
      (isLast ? progressSec <= regions[i].end : progressSec < regions[i].end)
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

/** Block Remove when either side of the merged boundary is recorded (TT-7666).
 *  Assumes sorted input. */
export function isRemoveBlockedByRecording(
  progressSec: number,
  regions: IRegion[],
  tol: number,
  isSegmentRecorded?: (index: number) => boolean
): boolean {
  if (!isSegmentRecorded || regions.length < 2) return false;
  for (let i = 0; i < regions.length - 1; i++) {
    if (Math.abs(progressSec - regions[i].end) <= tol) {
      return isSegmentRecorded(i) || isSegmentRecorded(i + 1);
    }
  }
  return false;
}
