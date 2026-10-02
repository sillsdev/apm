/**
 * Live waveform peaks capture for recording (TT: wavesurfer refresh while recording).
 *
 * Mirrors the technique of the wavesurfer.js record plugin: tap the mic stream
 * with an AnalyserNode and reduce it to max-abs peaks (100/sec). The consumer
 * renders them with `wavesurfer.load('', [peaks], duration)`, which skips
 * fetch/decode entirely — constant cost per refresh regardless of recording
 * length. The recorded audio itself is NOT produced here; recorders still own
 * the data path and the complete take is loaded for real on stop.
 */

export const RECORD_PEAKS_PER_SECOND = 100;
const SAMPLE_INTERVAL_MS = 10;
const DEFAULT_EMIT_INTERVAL_MS = 100;
const INITIAL_CAPACITY_SECONDS = 30;

export interface RecordPeaksCapture {
  stop: () => void;
}

/**
 * Ensure capacity and fill slots [count, targetCount) with `peak`.
 * Slots are time-indexed (targetCount = elapsedSec * peaksPerSecond) so the
 * waveform stays time-accurate even when timer callbacks are delayed.
 * Exported for unit tests.
 */
export function fillPeaks(
  peaks: Float32Array,
  count: number,
  targetCount: number,
  peak: number
): { peaks: Float32Array; count: number } {
  if (targetCount <= count) return { peaks, count };
  let out = peaks;
  if (targetCount > out.length) {
    let capacity = Math.max(out.length, 1);
    while (capacity < targetCount) capacity *= 2;
    const grown = new Float32Array(capacity);
    grown.set(out, 0);
    out = grown;
  }
  out.fill(peak, count, targetCount);
  return { peaks: out, count: targetCount };
}

/**
 * Start sampling peaks from `stream`. Calls `onPeaks(peaks, seconds)` on a
 * steady cadence; `peaks` is a subarray view valid only during the callback —
 * copy it synchronously (combining into a new array counts).
 * Returns a no-op capture if the AudioContext/analyser cannot be created.
 */
export function createRecordPeaksCapture(
  stream: MediaStream,
  onPeaks: (peaks: Float32Array, seconds: number) => void,
  emitIntervalMs: number = DEFAULT_EMIT_INTERVAL_MS
): RecordPeaksCapture {
  let audioContext: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let analyser: AnalyserNode | undefined;
  try {
    audioContext = new AudioContext();
    source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    // ~21ms window at 48kHz; sampled every 10ms so no audio is skipped.
    analyser.fftSize = 1024;
    source.connect(analyser);
    // iOS Safari creates contexts suspended outside a direct user gesture; a
    // suspended analyser reads all zeros (flat preview). Fire-and-forget.
    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => {});
    }
  } catch (e) {
    console.error('recordPeaksCapture: cannot tap mic stream', e);
    try {
      source?.disconnect();
    } catch {
      /* */
    }
    void audioContext?.close().catch(() => {});
    return { stop: () => {} };
  }

  const timeDomain = new Float32Array(analyser.fftSize);
  // Annotated so assignment from fillPeaks (Float32Array<ArrayBufferLike>)
  // doesn't fail against the narrower inferred Float32Array<ArrayBuffer>.
  let peaks: Float32Array = new Float32Array(
    RECORD_PEAKS_PER_SECOND * INITIAL_CAPACITY_SECONDS
  );
  let count = 0;
  const startedAt = performance.now();
  let lastEmitAt = 0;

  const intervalId = setInterval(() => {
    const now = performance.now();
    const elapsedSec = (now - startedAt) / 1000;
    const targetCount = Math.floor(elapsedSec * RECORD_PEAKS_PER_SECOND);
    if (targetCount > count && analyser) {
      analyser.getFloatTimeDomainData(timeDomain);
      let peak = 0;
      for (let i = 0; i < timeDomain.length; i++) {
        const v = Math.abs(timeDomain[i]);
        if (v > peak) peak = v;
      }
      ({ peaks, count } = fillPeaks(peaks, count, targetCount, peak));
    }
    if (count > 0 && now - lastEmitAt >= emitIntervalMs) {
      lastEmitAt = now;
      onPeaks(peaks.subarray(0, count), count / RECORD_PEAKS_PER_SECOND);
    }
  }, SAMPLE_INTERVAL_MS);

  const stop = () => {
    clearInterval(intervalId);
    try {
      source?.disconnect();
    } catch {
      /* */
    }
    try {
      analyser?.disconnect();
    } catch {
      /* */
    }
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(() => {});
    }
  };

  return { stop };
}
