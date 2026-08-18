/** Cap matches wavesurfer.js exportPeaks default — enough for the canvas. */
export const WAVEFORM_PEAKS_MAX = 8000;

/**
 * Downsampled max-abs peaks for `wavesurfer.load(url, peaks, duration)`.
 * Passing peaks skips WaveSurfer's fetch+decode of the blob URL (a second
 * ~200MB copy that cancels the media element's load on large files).
 */
export function waveformPeaks(buffer: AudioBuffer): Float32Array[] {
  const channels = Math.max(buffer.numberOfChannels, 1);
  const srcLen = buffer.length;
  if (srcLen <= 0) {
    return Array.from({ length: channels }, () => new Float32Array(1));
  }
  const length = Math.min(WAVEFORM_PEAKS_MAX, srcLen);
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
