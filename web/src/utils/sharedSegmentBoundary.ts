const roundToFiveDecimals = (n: number) => Math.round(n * 100000) / 100000;

/** Smallest segment we allow a boundary drag to leave behind. Keeps a segment
 *  from collapsing (or inverting) when its shared boundary is pushed all the
 *  way into a neighbor, and stays above the 0.03s load filter in loadRegions. */
export const MIN_SEGMENT_SEC = 0.05;

export interface IBoundarySegment {
  start: number;
  end: number;
}

export interface ISharedBoundary {
  /** Clamped bounds for the dragged segment. */
  start: number;
  end: number;
  /** The boundary the drag settled on — where the playhead should follow. */
  boundary: number;
}

interface IClampArgs {
  /** Live bounds of the segment being resized. */
  segment: IBoundarySegment;
  /** Neighbor sharing the dragged segment's start, if any. */
  prev?: IBoundarySegment;
  /** Neighbor sharing the dragged segment's end, if any. */
  next?: IBoundarySegment;
  /** Waveform duration — the outer edge the last segment is pinned to. */
  duration: number;
  /** Which boundary the plugin says is moving; when absent, clamp both. */
  side?: 'start' | 'end';
  minSegment?: number;
}

/**
 * Compute the clamped bounds for a segment whose boundary the user is dragging.
 *
 * Segment maps are contiguous: the end of one segment is the start of the next,
 * so a boundary belongs to two segments at once. Dragging it must
 *   - stop at the neighbor's far boundary (never overlap), leaving at least
 *     `minSegment` of the neighbor behind; and
 *   - leave the first segment's start pinned to 0 and the last segment's end
 *     pinned to `duration`, since there is nothing beyond them to share with.
 *
 * The caller moves the neighbor's shared boundary to the returned `start` /
 * `end` so the two segments stay flush.
 */
export function clampSharedBoundary({
  segment,
  prev,
  next,
  duration,
  side,
  minSegment = MIN_SEGMENT_SEC,
}: IClampArgs): ISharedBoundary {
  let { start, end } = segment;
  if (side !== 'end') {
    // Dragging the start: clamp between the previous segment's start (+gap)
    // and this segment's own end (-gap).
    const upper = end - minSegment;
    start = prev
      ? roundToFiveDecimals(
          Math.max(prev.start + minSegment, Math.min(start, upper))
        )
      : 0;
  }
  if (side !== 'start') {
    // Dragging the end: clamp between this segment's (possibly just clamped)
    // start (+gap) and the next segment's end (-gap).
    const lower = start + minSegment;
    end = next
      ? roundToFiveDecimals(
          Math.min(next.end - minSegment, Math.max(end, lower))
        )
      : duration;
  }
  return { start, end, boundary: side === 'start' ? start : end };
}
