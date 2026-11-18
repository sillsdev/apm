import { audioBufferToWavBlob } from './audioBufferToWavBlob';

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

  return audioBufferToWavBlob(rendered);
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

  return audioBufferToWavBlob(rendered);
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

  return audioBufferToWavBlob(rendered);
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
    blob: await audioBufferToWavBlob(rendered),
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

/**
 * Normalize the range `startSec`–`endSec` of an audio Blob (all of it by
 * default) to -23 LUFS with one gain, lowered if needed to keep every sample
 * at or below -2 dB, and return the whole audio as WAV. Resolves undefined
 * when the range is too quiet to measure.
 */
export async function normalizeAudio(
  blob: Blob,
  startSec = 0,
  endSec = Infinity
): Promise<Blob | undefined> {
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(await blob.arrayBuffer());
  await audioCtx.close();

  const { length, sampleRate } = decoded;
  const start = Math.min(length, Math.round(startSec * sampleRate));
  const end = Math.min(length, Math.round(endSec * sampleRate));
  // Views into `decoded`, so scaling them below changes the decoded audio.
  const channels = Array.from({ length: decoded.numberOfChannels }, (_, ch) =>
    decoded.getChannelData(ch).subarray(start, end)
  );
  const loudness = integratedLoudness(channels, sampleRate);
  if (loudness === undefined) return undefined;

  let peak = 0;
  for (const ch of channels) {
    for (const sample of ch) peak = Math.max(peak, Math.abs(sample));
  }
  const gainDb = Math.min(
    TARGET_LUFS - loudness,
    PEAK_CEILING_DB - 20 * Math.log10(peak)
  );
  const gain = 10 ** (gainDb / 20);
  for (const ch of channels) {
    for (let i = 0; i < ch.length; i++) ch[i] *= gain;
  }
  return audioBufferToWavBlob(decoded);
}

/** b0, b1, b2, a1, a2 of a biquad filter (a0 normalized to 1). */
type Biquad = [number, number, number, number, number];

function biquad(
  x: ArrayLike<number>,
  [b0, b1, b2, a1, a2]: Biquad
): Float64Array {
  const y = new Float64Array(x.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    y[i] = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1;
    x1 = x[i];
    y2 = y1;
    y1 = y[i];
  }
  return y;
}

/**
 * ITU BS.1770 K-weighting: a +4 dB high shelf above about 1.5 kHz (the head's
 * effect on sound), then a high pass that cuts bass below about 40 Hz. The
 * standard lists 48 kHz coefficients; these formulas (from libebur128) give
 * them for any rate.
 */
function kWeight(samples: Float32Array, sampleRate: number): Float64Array {
  const sK = Math.tan((Math.PI * 1681.974450955533) / sampleRate);
  const sQ = 0.7071752369554196;
  const vh = 10 ** (3.999843853973347 / 20);
  const vb = vh ** 0.4996667741545416;
  const sA0 = 1 + sK / sQ + sK * sK;
  const shelf: Biquad = [
    (vh + (vb * sK) / sQ + sK * sK) / sA0,
    (2 * (sK * sK - vh)) / sA0,
    (vh - (vb * sK) / sQ + sK * sK) / sA0,
    (2 * (sK * sK - 1)) / sA0,
    (1 - sK / sQ + sK * sK) / sA0,
  ];
  const hK = Math.tan((Math.PI * 38.13547087602444) / sampleRate);
  const hQ = 0.5003270373238773;
  const hA0 = 1 + hK / hQ + hK * hK;
  const highPass: Biquad = [
    1,
    -2,
    1,
    (2 * (hK * hK - 1)) / hA0,
    (1 - hK / hQ + hK * hK) / hA0,
  ];
  return biquad(biquad(samples, shelf), highPass);
}

/**
 * Integrated loudness in LUFS (ITU BS.1770 / EBU R128): K-weighted energy of
 * 400 ms blocks taken every 100 ms, skipping blocks below -70 LUFS (silence)
 * and blocks more than 10 LU below the average of the rest (pauses). Audio
 * shorter than 400 ms is measured as one block. Undefined when all is silent.
 */
function integratedLoudness(
  channels: Float32Array[],
  sampleRate: number
): number | undefined {
  const length = channels[0].length;
  const blockLen = Math.min(length, Math.round(0.4 * sampleRate));
  if (!blockLen) return undefined;
  const step = Math.round(0.1 * sampleRate);
  const weighted = channels.map((ch) => kWeight(ch, sampleRate));
  const energies: number[] = [];
  for (let start = 0; start + blockLen <= length; start += step) {
    let sum = 0;
    for (const ch of weighted) {
      for (let i = start; i < start + blockLen; i++) sum += ch[i] * ch[i];
    }
    energies.push(sum / blockLen);
  }
  const lufs = (energy: number) => -0.691 + 10 * Math.log10(energy);
  const mean = (values: number[]) =>
    values.reduce((a, b) => a + b, 0) / values.length;
  const audible = energies.filter((e) => lufs(e) > -70);
  if (!audible.length) return undefined;
  const relativeGate = lufs(mean(audible)) - 10;
  return lufs(mean(audible.filter((e) => lufs(e) > relativeGate)));
}

/** EBU R128 loudness target. */
const TARGET_LUFS = -23;
/** Highest sample allowed after normalizing, in dB below full scale. */
const PEAK_CEILING_DB = -2;

/** Decode a base-64 string into a Blob. */
export function fromBase64(base64: string, type = 'audio/wav'): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type });
}
