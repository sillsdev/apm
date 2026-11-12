/** Cap matches wavesurfer.js exportPeaks default — enough for the canvas. */
export const WAVEFORM_PEAKS_MAX = 8000;

/**
 * Downsampled max-abs peaks covering the full buffer.
 * sampleSize is fractional so every source sample falls in a bucket — unlike
 * wavesurfer exportPeaks, which uses Math.round(length/maxLength) and can
 * leave a tail unsampled when the channel is already downsampled.
 */
export function waveformPeaks(
  buffer: AudioBuffer,
  maxLength: number = WAVEFORM_PEAKS_MAX
): Float32Array[] {
  const channels = Math.max(buffer.numberOfChannels, 1);
  const srcLen = buffer.length;
  if (srcLen <= 0) {
    return Array.from({ length: channels }, () => new Float32Array(1));
  }
  const length = Math.min(Math.max(1, maxLength), srcLen);
  const sampleSize = srcLen / length;
  const peaks: Float32Array[] = [];
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    const peak = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      const start = Math.floor(i * sampleSize);
      const end = Math.max(
        start + 1,
        Math.min(Math.floor((i + 1) * sampleSize), data.length)
      );
      let max = 0;
      for (let j = start; j < end; j++) {
        const v = Math.abs(data[j] ?? 0);
        if (v > max) max = v;
      }
      peak[i] = max;
    }
    peaks.push(peak);
  }
  return peaks;
}
