import { IRegion } from '../crud/useWavesurferRegions';

/**
 * Pure helpers deciding when the player's +/- segment controls must be disabled
 * because a recording depends on the boundary (TT-7666). Kept out of
 * WSAudioPlayer so they can be unit-tested without the component's app-wide
 * import tree.
 */

/** Sorted index of the segment the playhead sits in, or -1. The last segment
 *  includes its end so the very end of the track still resolves. */
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

/** Add (+) would split the segment under the playhead; block it when that
 *  segment is recorded (TT-7666). */
export function isAddBlockedByRecording(
  progressSec: number,
  regions: IRegion[],
  isSegmentRecorded?: (index: number) => boolean
): boolean {
  if (!isSegmentRecorded) return false;
  const idx = segmentIndexAtProgress(progressSec, regions);
  return idx >= 0 && isSegmentRecorded(idx);
}

/** Remove (−) merges the two segments flanking the internal join near the
 *  playhead; block it when either is recorded (TT-7666). */
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
