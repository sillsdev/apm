import { fillPeaks, RECORD_PEAKS_PER_SECOND } from '../recordPeaksCapture';

describe('fillPeaks', () => {
  it('fills [count, targetCount) with the peak value', () => {
    const initial = new Float32Array(8);
    const { peaks, count } = fillPeaks(initial, 2, 5, 0.5);
    expect(count).toBe(5);
    expect(peaks).toBe(initial); // no growth needed
    expect(Array.from(peaks.slice(0, 6))).toEqual([0, 0, 0.5, 0.5, 0.5, 0]);
  });

  it('returns unchanged when target is not past count', () => {
    const initial = new Float32Array([0.1, 0.2]);
    const { peaks, count } = fillPeaks(initial, 2, 2, 0.9);
    expect(count).toBe(2);
    expect(Array.from(peaks)).toEqual(Array.from(new Float32Array([0.1, 0.2])));
  });

  it('doubles capacity while preserving existing peaks', () => {
    const initial = new Float32Array([0.25, 0.75]);
    const { peaks, count } = fillPeaks(initial, 2, 7, 1);
    expect(count).toBe(7);
    expect(peaks.length).toBeGreaterThanOrEqual(7);
    expect(peaks[0]).toBeCloseTo(0.25);
    expect(peaks[1]).toBeCloseTo(0.75);
    for (let i = 2; i < 7; i++) expect(peaks[i]).toBe(1);
  });

  it('grows across multiple doublings (long recording)', () => {
    let peaks: Float32Array = new Float32Array(4);
    let count = 0;
    // Simulate 10 minutes of recording in 1-second steps
    for (let sec = 1; sec <= 600; sec++) {
      ({ peaks, count } = fillPeaks(
        peaks,
        count,
        sec * RECORD_PEAKS_PER_SECOND,
        0.3
      ));
    }
    expect(count).toBe(600 * RECORD_PEAKS_PER_SECOND);
    expect(peaks.length).toBeGreaterThanOrEqual(count);
    expect(peaks[count - 1]).toBeCloseTo(0.3);
  });
});
