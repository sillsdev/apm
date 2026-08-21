import { clampSharedBoundary, MIN_SEGMENT_SEC } from './sharedSegmentBoundary';

const DURATION = 10;

describe('clampSharedBoundary', () => {
  it('leaves an in-range end drag alone so the next segment follows it', () => {
    const { start, end, boundary } = clampSharedBoundary({
      segment: { start: 2, end: 4.5 },
      prev: { start: 0, end: 2 },
      next: { start: 4, end: 7 },
      duration: DURATION,
      side: 'end',
    });
    expect(start).toBe(2);
    expect(end).toBe(4.5);
    // caller sets next.start = end, keeping the pair flush
    expect(boundary).toBe(4.5);
  });

  it('leaves an in-range start drag alone so the previous segment follows it', () => {
    const { start, end, boundary } = clampSharedBoundary({
      segment: { start: 1.5, end: 4 },
      prev: { start: 0, end: 2 },
      next: { start: 4, end: 7 },
      duration: DURATION,
      side: 'start',
    });
    expect(start).toBe(1.5);
    expect(end).toBe(4);
    expect(boundary).toBe(1.5);
  });

  it('stops an end drag before it swallows the next segment', () => {
    const { end } = clampSharedBoundary({
      segment: { start: 2, end: 9 }, // dragged past next.end
      next: { start: 4, end: 7 },
      duration: DURATION,
      side: 'end',
    });
    expect(end).toBe(7 - MIN_SEGMENT_SEC);
  });

  it('stops a start drag before it swallows the previous segment', () => {
    const { start } = clampSharedBoundary({
      segment: { start: -1, end: 4 }, // dragged past prev.start
      prev: { start: 1, end: 2 },
      duration: DURATION,
      side: 'start',
    });
    expect(start).toBe(1 + MIN_SEGMENT_SEC);
  });

  it('keeps the dragged segment from collapsing onto itself', () => {
    const collapsedEnd = clampSharedBoundary({
      segment: { start: 2, end: 1 }, // end dragged left of start
      next: { start: 4, end: 7 },
      duration: DURATION,
      side: 'end',
    });
    expect(collapsedEnd.end).toBe(2 + MIN_SEGMENT_SEC);

    const collapsedStart = clampSharedBoundary({
      segment: { start: 5, end: 4 }, // start dragged right of end
      prev: { start: 0, end: 2 },
      duration: DURATION,
      side: 'start',
    });
    expect(collapsedStart.start).toBe(4 - MIN_SEGMENT_SEC);
  });

  it('pins the first segment to 0 and the last to the duration', () => {
    const first = clampSharedBoundary({
      segment: { start: 0.4, end: 3 },
      next: { start: 3, end: 6 },
      duration: DURATION,
      side: 'start',
    });
    expect(first.start).toBe(0);

    const last = clampSharedBoundary({
      segment: { start: 6, end: 9.2 },
      prev: { start: 3, end: 6 },
      duration: DURATION,
      side: 'end',
    });
    expect(last.end).toBe(DURATION);
  });

  it('clamps both boundaries when the plugin reports no side', () => {
    const { start, end, boundary } = clampSharedBoundary({
      segment: { start: 0.5, end: 20 },
      prev: { start: 1, end: 2 },
      next: { start: 4, end: 7 },
      duration: DURATION,
    });
    expect(start).toBe(1 + MIN_SEGMENT_SEC);
    expect(end).toBe(7 - MIN_SEGMENT_SEC);
    expect(boundary).toBe(end);
  });

  it('rounds to the 5 decimals the seek uses', () => {
    const { end } = clampSharedBoundary({
      segment: { start: 0, end: 1.2345678 },
      next: { start: 1.2, end: 5 },
      duration: DURATION,
      side: 'end',
    });
    expect(end).toBe(1.23457);
  });

  it('honors an explicit minSegment', () => {
    const { end } = clampSharedBoundary({
      segment: { start: 2, end: 9 },
      next: { start: 4, end: 7 },
      duration: DURATION,
      side: 'end',
      minSegment: 0.5,
    });
    expect(end).toBe(6.5);
  });
});
