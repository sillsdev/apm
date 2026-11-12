import {
  extractSilenceRegions,
  segmentPeakCount,
} from './extractSilenceRegions';
import { WAVEFORM_PEAKS_MAX, waveformPeaks } from './waveformPeaks';
import type { IRegionParams } from './useWavesurferRegions';

function fakeBuffer(data: Float32Array, sampleRate: number): AudioBuffer {
  return {
    numberOfChannels: 1,
    length: data.length,
    sampleRate,
    duration: data.length / sampleRate,
    getChannelData: () => data,
  } as unknown as AudioBuffer;
}

/** wavesurfer.js exportPeaks: integer sampleSize, always `maxLength` buckets. */
function exportPeaksLikeWavesurfer(
  channel: Float32Array,
  maxLength: number
): number[] {
  const sampleSize = Math.round(channel.length / maxLength) || 1;
  const data: number[] = [];
  for (let i = 0; i < maxLength; i++) {
    const from = Math.floor(i * sampleSize);
    const to = Math.ceil((i + 1) * sampleSize);
    let max = 0;
    for (let x = from; x < to && x < channel.length; x++) {
      const n = channel[x] ?? 0;
      if (Math.abs(n) > Math.abs(max)) max = n;
    }
    data.push(max);
  }
  return data;
}

function speechWithSilences(
  durationSec: number,
  sampleRate: number,
  silences: Array<[number, number]>
): Float32Array {
  const data = new Float32Array(durationSec * sampleRate);
  data.fill(0.5);
  for (const [from, to] of silences) {
    const a = Math.floor(from * sampleRate);
    const b = Math.floor(to * sampleRate);
    data.fill(0, a, b);
  }
  return data;
}

describe('extractSilenceRegions', () => {
  const params: IRegionParams = {
    silenceThreshold: 0.002,
    timeThreshold: 0.05,
    segLenThreshold: 0.5,
  };

  it('places boundaries at known silences on a multi-minute buffer', () => {
    const durationSec = 300;
    const sampleRate = 100;
    const silences: Array<[number, number]> = [
      [50, 55],
      [150, 160],
    ];
    const buffer = fakeBuffer(
      speechWithSilences(durationSec, sampleRate, silences),
      sampleRate
    );
    const numPeaks = segmentPeakCount(durationSec, params.timeThreshold);
    const peaks = waveformPeaks(buffer, numPeaks)[0]!;
    const regions = extractSilenceRegions(peaks, durationSec, params);

    expect(numPeaks).toBe(6000);
    expect(peaks.length).toBe(6000);
    expect(regions).toHaveLength(3);
    expect(regions[0]!.start).toBe(0);
    expect(regions[0]!.end).toBeCloseTo(55, 0);
    expect(regions[1]!.start).toBeCloseTo(55, 0);
    expect(regions[1]!.end).toBeCloseTo(160, 0);
    expect(regions[2]!.start).toBeCloseTo(160, 0);
    expect(regions[2]!.end).toBe(durationSec);
  });

  it('does not stretch boundaries when render peaks are shorter than the requested count', () => {
    const durationSec = 300;
    const sampleRate = 100;
    const buffer = fakeBuffer(
      speechWithSilences(durationSec, sampleRate, [[50, 55]]),
      sampleRate
    );
    const numPeaks = segmentPeakCount(durationSec, params.timeThreshold);
    const renderPeaks = waveformPeaks(buffer)[0]!;
    expect(renderPeaks.length).toBe(WAVEFORM_PEAKS_MAX);

    const broken = exportPeaksLikeWavesurfer(renderPeaks, numPeaks);
    const bad = extractSilenceRegions(broken, durationSec, params);
    const good = extractSilenceRegions(
      waveformPeaks(buffer, numPeaks)[0]!,
      durationSec,
      params
    );

    expect(good[0]!.end).toBeCloseTo(55, 0);
    expect(Math.abs((bad[0]?.end ?? 0) - 55)).toBeGreaterThan(5);
  });
});
