// import { Mp3Encoder } from "@breezystack/lamejs";

/**
 * Remove a time range from an audio Blob, returning a new WAV Blob with the
 * segment between `startSec` and `endSec` spliced out.
 * Preserves all channels and sample rate.
 */
export async function spliceAudio(
  blob: Blob,
  startSec: number,
  endSec: number
): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  const sampleRate = decoded.sampleRate;
  const numChannels = decoded.numberOfChannels;
  const startSample = Math.round(startSec * sampleRate);
  const endSample = Math.round(endSec * sampleRate);
  const totalSamples = decoded.length;

  const newLength = totalSamples - (endSample - startSample);
  if (newLength <= 0) {
    await audioCtx.close();
    // Nothing left — return a tiny silent WAV
    return new Blob([], { type: 'audio/wav' });
  }

  const offlineCtx = new OfflineAudioContext(
    numChannels,
    newLength,
    sampleRate
  );
  const newBuffer = offlineCtx.createBuffer(numChannels, newLength, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const src = decoded.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    // Copy before the cut
    dst.set(src.subarray(0, startSample), 0);
    // Copy after the cut
    dst.set(src.subarray(endSample), startSample);
  }

  // Render to get a proper AudioBuffer, then encode to WAV
  const source = offlineCtx.createBufferSource();
  source.buffer = newBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  await audioCtx.close();

  return audioBufferToWav(rendered);
}

/**
 * Extract a time range from an audio Blob, returning a new WAV Blob containing
 * only the segment between `startSec` and `endSec` (the complement of
 * `spliceAudio`). The range is clamped to the audio; an empty range yields an
 * empty Blob. Preserves all channels and sample rate.
 */
export async function clipAudio(
  blob: Blob,
  startSec: number,
  endSec: number
): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  const sampleRate = decoded.sampleRate;
  const numChannels = decoded.numberOfChannels;
  const totalSamples = decoded.length;
  const startSample = Math.max(
    0,
    Math.min(totalSamples, Math.round(startSec * sampleRate))
  );
  const endSample = Math.max(
    startSample,
    Math.min(totalSamples, Math.round(endSec * sampleRate))
  );
  const newLength = endSample - startSample;

  if (newLength <= 0) {
    await audioCtx.close();
    return new Blob([], { type: 'audio/wav' });
  }

  const offlineCtx = new OfflineAudioContext(
    numChannels,
    newLength,
    sampleRate
  );
  const newBuffer = offlineCtx.createBuffer(numChannels, newLength, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const src = decoded.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    dst.set(src.subarray(startSample, endSample), 0);
  }

  const source = offlineCtx.createBufferSource();
  source.buffer = newBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  await audioCtx.close();

  return audioBufferToWav(rendered);
}

/**
 * Insert a span of silence into an audio Blob at `atSec`.
 * Returns a new WAV Blob with all channels and sample rate preserved.
 */
export async function insertSilenceAudio(
  blob: Blob,
  atSec: number,
  silenceDurationSec: number
): Promise<Blob> {
  if (silenceDurationSec <= 0) return blob;

  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer);

  const sampleRate = decoded.sampleRate;
  const numChannels = decoded.numberOfChannels;
  const insertSample = Math.max(
    0,
    Math.min(decoded.length, Math.round(atSec * sampleRate))
  );
  const silenceSamples = Math.max(
    1,
    Math.round(silenceDurationSec * sampleRate)
  );
  const newLength = decoded.length + silenceSamples;

  const offlineCtx = new OfflineAudioContext(
    numChannels,
    newLength,
    sampleRate
  );
  const newBuffer = offlineCtx.createBuffer(numChannels, newLength, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const src = decoded.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    // Copy segment before insertion.
    dst.set(src.subarray(0, insertSample), 0);
    // The inserted section is left as zeros (silence).
    // Copy segment after insertion.
    dst.set(src.subarray(insertSample), insertSample + silenceSamples);
  }

  const source = offlineCtx.createBufferSource();
  source.buffer = newBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  await audioCtx.close();

  return audioBufferToWav(rendered);
}

/**
 * Replace a time range in an audio Blob with audio from another Blob.
 * Returns the new WAV Blob and the duration of the replacement segment.
 */
export async function replaceAudioSegment(
  originalBlob: Blob,
  startSec: number,
  endSec: number,
  replacementBlob: Blob
): Promise<{ blob: Blob; replacementDuration: number }> {
  const audioCtx = new AudioContext();
  const [origBuf, replBuf] = await Promise.all([
    audioCtx.decodeAudioData(await originalBlob.arrayBuffer()),
    audioCtx.decodeAudioData(await replacementBlob.arrayBuffer()),
  ]);

  const sampleRate = origBuf.sampleRate;
  const numChannels = origBuf.numberOfChannels;

  // Resample replacement if needed
  let resampled = replBuf;
  if (
    replBuf.sampleRate !== sampleRate ||
    replBuf.numberOfChannels !== numChannels
  ) {
    const resampledLength = Math.ceil(replBuf.duration * sampleRate);
    const resampleCtx = new OfflineAudioContext(
      numChannels,
      resampledLength,
      sampleRate
    );
    const src = resampleCtx.createBufferSource();
    src.buffer = replBuf;
    src.connect(resampleCtx.destination);
    src.start();
    resampled = await resampleCtx.startRendering();
  }

  const startSample = Math.max(
    0,
    Math.min(origBuf.length, Math.round(startSec * sampleRate))
  );
  const endSample = Math.max(
    startSample,
    Math.min(origBuf.length, Math.round(endSec * sampleRate))
  );
  const replSamples = resampled.length;
  const newLength = startSample + replSamples + (origBuf.length - endSample);

  if (newLength <= 0) {
    await audioCtx.close();
    return {
      blob: new Blob([], { type: 'audio/wav' }),
      replacementDuration: resampled.duration,
    };
  }

  const offlineCtx = new OfflineAudioContext(
    numChannels,
    newLength,
    sampleRate
  );
  const newBuffer = offlineCtx.createBuffer(numChannels, newLength, sampleRate);

  for (let ch = 0; ch < numChannels; ch++) {
    const origData = origBuf.getChannelData(ch);
    const replData = resampled.getChannelData(ch);
    const dst = newBuffer.getChannelData(ch);
    // Before the replaced region
    dst.set(origData.subarray(0, startSample), 0);
    // Replacement audio
    dst.set(replData, startSample);
    // After the replaced region
    dst.set(origData.subarray(endSample), startSample + replSamples);
  }

  const source = offlineCtx.createBufferSource();
  source.buffer = newBuffer;
  source.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  await audioCtx.close();

  return {
    blob: audioBufferToWav(rendered),
    replacementDuration: resampled.duration,
  };
}

/**
 * Compose multiple replacements into a source audio blob in chronological order.
 * Returns the composed audio blob, replacement highlights, and cumulative offset map.
 */
export async function composeReplacements(
  sourceBlob: Blob,
  replacements: Array<{
    selection: { start: number; end: number };
    audio: Blob;
  }>
): Promise<{
  blob: Blob;
  highlights: { start: number; end: number; color: string }[];
  offsetMap: { composedStart: number; composedEnd: number; offset: number }[];
}> {
  const sorted = [...replacements].sort(
    (a, b) => a.selection.start - b.selection.start
  );

  let current = sourceBlob;
  let offset = 0;
  const highlights: { start: number; end: number; color: string }[] = [];
  const offsetMap: {
    composedStart: number;
    composedEnd: number;
    offset: number;
  }[] = [];

  for (const r of sorted) {
    const adjustedStart = r.selection.start + offset;
    const adjustedEnd = r.selection.end + offset;
    const { blob, replacementDuration } = await replaceAudioSegment(
      current,
      adjustedStart,
      adjustedEnd,
      r.audio
    );
    current = blob;
    const replacedDuration = r.selection.end - r.selection.start;
    offset += replacementDuration - replacedDuration;

    highlights.push({
      start: adjustedStart,
      end: adjustedStart + replacementDuration,
      color: '#ff660091',
    });
    offsetMap.push({
      composedStart: adjustedStart,
      composedEnd: adjustedStart + replacementDuration,
      offset,
    });
  }

  return { blob: current, highlights, offsetMap };
}

/**
 * Convert a time coordinate from the preview waveform's time domain to the
 * original audio's time domain.
 *
 * When a replacement is spliced into the original audio, the resulting preview
 * has a different duration. This creates three zones in the preview:
 *
 *   1. Before the replacement (0 → replacementStart): unchanged, maps 1:1.
 *   2. The replacement itself (replacementStart → replacementEndInPreview):
 *      maps linearly onto [replacementStart, originalSegmentEnd].
 *   3. After the replacement (replacementEndInPreview → end): shifted by the
 *      duration difference between the original segment and the replacement.
 */
export function mapPreviewTimeToOriginalTime(
  previewTime: number,
  replacementStart: number,
  replacementEndInPreview: number,
  originalSegmentEnd: number
): number {
  // Before the replacement zone — preview and original are identical
  if (previewTime <= replacementStart) return previewTime;

  // After the replacement zone — shift by the duration difference
  if (previewTime >= replacementEndInPreview) {
    return previewTime + (originalSegmentEnd - replacementEndInPreview);
  }

  // Within the replacement zone — linearly interpolate between the boundaries
  const fraction =
    (previewTime - replacementStart) /
    (replacementEndInPreview - replacementStart);
  return replacementStart + fraction * (originalSegmentEnd - replacementStart);
}

/** Encode an AudioBuffer as a WAV Blob. */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const headerSize = 44;
  const arrayBuffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(arrayBuffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, 'WAVE');
  // fmt chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  // Interleave channel data as 16-bit PCM
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Clamp a selection so it stays within a single "free zone" (gap between
 * highlights).  Returns the clamped selection, or null if invalid.
 *
 * @param mode  Which bound is moving:
 *   - `'end'`   – end handle moving, start is anchor
 *   - `'start'` – start handle moving, end is anchor
 *   - `'pan'`   – both bounds moving together
 * @param prevSel  Previous selection (needed for pan direction detection)
 */
export function clampSelectionToHighlights(
  sel: { start: number; end: number },
  highlights: { start: number; end: number }[],
  mode: 'start' | 'end' | 'pan',
  prevSel?: { start: number; end: number } | null
): { start: number; end: number } | null {
  if (!highlights.length) return sel;

  const sorted = highlights.slice().sort((a, b) => a.start - b.start);

  // Reference point — guaranteed to be in the correct free zone.
  const ref =
    mode === 'end'
      ? sel.start // end handle moving → start is anchor
      : mode === 'start'
        ? sel.end // start handle moving → end is anchor
        : (prevSel?.start ?? sel.start); // pan → pre-drag position

  // Find free zone [zoneMin, zoneMax] containing the reference.
  let zoneMin = 0;
  let zoneMax = Infinity;
  for (const h of sorted) {
    if (h.end <= ref) {
      zoneMin = Math.max(zoneMin, h.end);
    } else if (h.start >= ref) {
      zoneMax = Math.min(zoneMax, h.start);
      break;
    } else {
      // ref is inside a highlight
      return null;
    }
  }

  let { start, end } = sel;

  if (mode === 'pan' && prevSel) {
    const width = end - start;
    if (start > prevSel.start) {
      // Moving right — clamp the end (leading edge)
      end = Math.min(end, zoneMax);
      start = end - width;
    } else {
      // Moving left — clamp the start (leading edge)
      start = Math.max(start, zoneMin);
      end = start + width;
    }
  } else {
    start = Math.max(start, zoneMin);
    end = Math.min(end, zoneMax);
  }

  return start < end ? { start, end } : null;
}

/** Read a File/Blob as a base-64 data-URL string. */
export function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

/** Decode a base-64 string into a Blob. */
export function fromBase64(base64: string, type = 'audio/wav'): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type });
}
