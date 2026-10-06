/** Enough of AudioContext to allocate a sliced buffer in tests and production. */
export type AudioBufferFactory = (
  numberOfChannels: number,
  length: number,
  sampleRate: number
) => AudioBuffer;

export interface PasteSpan {
  start: number;
  /** Undefined loads the clip as the whole waveform. Equal to start inserts. */
  end: number | undefined;
}

/**
 * Copy [startSec, endSec) clamped to the buffer. Undefined when the overlap is empty.
 */
export function sliceAudioBuffer(
  buffer: AudioBuffer,
  startSec: number,
  endSec: number,
  createBuffer: AudioBufferFactory
): AudioBuffer | undefined {
  const { numberOfChannels, sampleRate, length } = buffer;
  if (sampleRate <= 0 || length <= 0 || numberOfChannels <= 0) return undefined;
  const startSample = Math.max(0, Math.floor(startSec * sampleRate));
  const endSample = Math.min(length, Math.floor(endSec * sampleRate));
  if (endSample <= startSample) return undefined;
  const sliced = createBuffer(
    numberOfChannels,
    endSample - startSample,
    sampleRate
  );
  for (let channel = 0; channel < numberOfChannels; channel++) {
    sliced
      .getChannelData(channel)
      .set(buffer.getChannelData(channel).subarray(startSample, endSample));
  }
  return sliced;
}

function clampTime(value: number, duration: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(duration, Math.max(0, value));
}

/**
 * Replace the region when it overlaps the buffer; otherwise insert at the playhead.
 * No buffer means the clip becomes the whole waveform.
 */
export function pasteSpan(
  region: { start: number; end: number } | undefined,
  playhead: number,
  buffer: { length: number; sampleRate: number } | undefined
): PasteSpan {
  if (!buffer || buffer.length <= 0 || buffer.sampleRate <= 0) {
    return { start: 0, end: undefined };
  }
  const duration = buffer.length / buffer.sampleRate;
  const insertAt = clampTime(playhead, duration);
  if (!region || !(region.end > region.start)) {
    return { start: insertAt, end: insertAt };
  }
  const startSample = Math.max(0, Math.floor(region.start * buffer.sampleRate));
  const endSample = Math.min(
    buffer.length,
    Math.floor(region.end * buffer.sampleRate)
  );
  if (endSample <= startSample) {
    return { start: insertAt, end: insertAt };
  }
  return {
    start: startSample / buffer.sampleRate,
    end: endSample / buffer.sampleRate,
  };
}
