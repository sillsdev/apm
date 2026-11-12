import {
  CHUNK_HEADER_BYTES,
  CHUNK_SIZE_OFFSET,
  FMT_CHANNELS_OFFSET,
  FMT_ID,
  FMT_MIN_BYTES,
  RIFF_HEADER_BYTES,
  RIFF_ID,
  RIFF_ID_OFFSET,
  WAVE_ID,
  WAVE_ID_OFFSET,
} from '../mediaRecordSize';

/** Big-endian JUNK chunk id, a padding chunk some tools write before fmt. */
const JUNK_ID = 0x4a554e4b;

/** Minimal RIFF/WAVE blob for tests. `size` is the file length; the header is written at the front. */
export function wavBlob(options?: {
  size?: number;
  channels?: number;
  /** Payload bytes of a JUNK chunk placed before fmt. */
  junk?: number;
  /** fmt chunk size. Shorter than 16 is not a readable fmt. */
  fmtSize?: number;
}): Blob {
  const channels = options?.channels ?? 1;
  const junk = options?.junk ?? 0;
  const fmtSize = options?.fmtSize ?? FMT_MIN_BYTES;
  // RIFF pads odd-sized chunks to an even boundary.
  const junkPadded = junk + (junk & 1);
  const before = junk > 0 ? CHUNK_HEADER_BYTES + junkPadded : 0;
  const fmtAt = RIFF_HEADER_BYTES + before + CHUNK_HEADER_BYTES;
  const bytes = new Uint8Array(
    Math.max(options?.size ?? fmtAt + fmtSize, fmtAt + fmtSize)
  );
  const view = new DataView(bytes.buffer);
  view.setUint32(RIFF_ID_OFFSET, RIFF_ID, false);
  view.setUint32(WAVE_ID_OFFSET, WAVE_ID, false);
  let cursor = RIFF_HEADER_BYTES;
  if (junk > 0) {
    view.setUint32(cursor, JUNK_ID, false);
    view.setUint32(cursor + CHUNK_SIZE_OFFSET, junk, true);
    cursor += CHUNK_HEADER_BYTES + junkPadded;
  }
  view.setUint32(cursor, FMT_ID, false);
  view.setUint32(cursor + CHUNK_SIZE_OFFSET, fmtSize, true);
  const data = cursor + CHUNK_HEADER_BYTES;
  if (fmtSize >= 4) view.setUint16(data + FMT_CHANNELS_OFFSET, channels, true);
  return new Blob([bytes], { type: 'audio/wav' });
}
