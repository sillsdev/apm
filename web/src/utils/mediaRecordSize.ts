/**
 * Opusenc runs with its defaults (convertToWebM.ts passes no bitrate), which
 * are 64 kbps mono and 96 kbps coupled stereo whatever the input sample rate.
 * So the encoded size depends only on duration and channel count.
 */
export const OPUS_MONO_BYTES_PER_SECOND = 64_000 / 8;

/** Coupled stereo defaults to 96 kbps, 1.5 times the mono stream. */
export const OPUS_STEREO_OVER_MONO = 96 / 64;

/**
 * Above the 64/96 kbps target so Ogg overhead and a VBR spike fail before encode.
 * A take this priced at 29.12 MB encoded to 31.29 MB.
 * fixed 15%.
 */
export const OPUS_ESTIMATE_HEADROOM = 1.15;

/** Float32 mono at WavRecorder's preferred 48 kHz. Live estimate when saving as WAV. */
export const RECORD_FLOAT32_BYTES_PER_SECOND = 48_000 * 4;

/** Big-endian RIFF fourcc. */
export const RIFF_ID = 0x52494646;
/** Big-endian WAVE form type. */
export const WAVE_ID = 0x57415645;
/** Big-endian fmt chunk id. */
export const FMT_ID = 0x666d7420;

export const RIFF_ID_OFFSET = 0;
export const WAVE_ID_OFFSET = 8;
export const RIFF_HEADER_BYTES = 12;
export const CHUNK_HEADER_BYTES = 8;
export const CHUNK_SIZE_OFFSET = 4;
export const FMT_MIN_BYTES = 16;
export const FMT_CHANNELS_OFFSET = 2;
/** fmt bytes through the channel count. */
export const FMT_CHANNELS_BYTES = 4;

/** Opus upload size for a take of this length. Stereo and up encode as stereo. */
export function estimatedOpusBytes(
  durationSeconds: number,
  channels: number
): number {
  const perSecond =
    channels >= 2
      ? OPUS_MONO_BYTES_PER_SECOND * OPUS_STEREO_OVER_MONO
      : OPUS_MONO_BYTES_PER_SECOND;
  return Math.max(0, durationSeconds) * perSecond * OPUS_ESTIMATE_HEADROOM;
}

/** Float32 WAV size of a live take, before the recorder hands over the file. */
export function estimatedLiveWavBytes(
  durationSeconds: number,
  channels: number
): number {
  return (
    Math.max(0, durationSeconds) *
    RECORD_FLOAT32_BYTES_PER_SECOND *
    (channels >= 2 ? 2 : 1)
  );
}

/**
 * Channel count from a WAV's fmt chunk. Anything that is not a readable WAV is
 * 1: only edited takes can be saved, and the editor always hands over a WAV.
 */
export async function wavChannelCount(blob: Blob): Promise<number> {
  const read = async (offset: number, length: number) => {
    if (offset < 0 || length <= 0 || offset + length > blob.size) return;
    return new DataView(
      await blob.slice(offset, offset + length).arrayBuffer()
    );
  };
  const head = await read(RIFF_ID_OFFSET, RIFF_HEADER_BYTES);
  if (
    !head ||
    head.getUint32(RIFF_ID_OFFSET, false) !== RIFF_ID ||
    head.getUint32(WAVE_ID_OFFSET, false) !== WAVE_ID
  ) {
    return 1;
  }
  let offset = RIFF_HEADER_BYTES;
  while (offset + CHUNK_HEADER_BYTES <= blob.size) {
    const chunk = await read(offset, CHUNK_HEADER_BYTES);
    if (!chunk) break;
    const id = chunk.getUint32(0, false);
    const size = chunk.getUint32(CHUNK_SIZE_OFFSET, true);
    const data = offset + CHUNK_HEADER_BYTES;
    if (size > blob.size - data) break;
    if (id === FMT_ID && size >= FMT_MIN_BYTES) {
      const fmt = await read(data, FMT_CHANNELS_BYTES);
      if (!fmt) break;
      return Math.max(1, fmt.getUint16(FMT_CHANNELS_OFFSET, true));
    }
    const padded = size + (size & 1);
    if (padded > blob.size - data) break;
    offset = data + padded;
  }
  return 1;
}
