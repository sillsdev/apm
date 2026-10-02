import { WAVEFORM_PEAKS_MAX, waveformPeaks } from './waveformPeaks';

function fakeBuffer(channels: Float32Array[], sampleRate = 100): AudioBuffer {
  const length = channels[0]?.length ?? 0;
  return {
    numberOfChannels: channels.length,
    length,
    sampleRate,
    duration: sampleRate ? length / sampleRate : 0,
    getChannelData: (ch: number) => channels[ch] ?? new Float32Array(0),
  } as AudioBuffer;
}

describe('waveformPeaks', () => {
  it('keeps a short buffer at full length and preserves the peak', () => {
    const data = new Float32Array(10);
    data[4] = 0.75;
    const peaks = waveformPeaks(fakeBuffer([data]));
    expect(peaks).toHaveLength(1);
    expect(peaks[0]).toHaveLength(10);
    expect(Math.max(...peaks[0]!)).toBeCloseTo(0.75);
  });

  it('downsamples a long buffer to WAVEFORM_PEAKS_MAX', () => {
    const data = new Float32Array(WAVEFORM_PEAKS_MAX * 4);
    data[100] = 1;
    const peaks = waveformPeaks(fakeBuffer([data, data]));
    expect(peaks).toHaveLength(2);
    expect(peaks[0]).toHaveLength(WAVEFORM_PEAKS_MAX);
    expect(Math.max(...peaks[0]!)).toBe(1);
  });

  it('covers the last sample when maxLength is less than buffer length', () => {
    const data = new Float32Array(8000);
    data[7999] = 1;
    const peaks = waveformPeaks(fakeBuffer([data]), 6000);
    expect(peaks[0]).toHaveLength(6000);
    expect(Math.max(...peaks[0]!)).toBe(1);
  });

  it('returns a placeholder for an empty buffer', () => {
    const peaks = waveformPeaks(fakeBuffer([new Float32Array(0)]));
    expect(peaks).toHaveLength(1);
    expect(peaks[0]).toHaveLength(1);
  });
});
