/** Mono 16-bit PCM at WavRecorder's 48 kHz. Live estimate before the blob exists. */
export const RECORD_PCM16_BYTES_PER_SECOND = 48_000 * 2;

/** Opusenc's default is 64 kbps. Mono 16-bit 48 kHz is 768 kbps, so 768/64. */
export const OPUS_MONO_COMPRESSION = 12;

/**
 * Above the 64/96 kbps target so Ogg overhead and a VBR spike fail before encode.
 * ponytail: fixed 5%. A file this holds back can still fit after a measured encode.
 */
export const OPUS_ESTIMATE_HEADROOM = 1.05;

/** Coupled stereo defaults to 96 kbps, 1.5 times the mono stream. */
const STEREO_BITRATE_OVER_MONO = 96 / 64;

/** float32 and pcm are files, so the byte length already includes every channel.
 *  live is the recording clock at mono 16-bit. encoded is ogg/mp3. */
export type AudioSource = 'float32' | 'pcm' | 'live' | 'encoded';

/** Channel count and how to price the blob. Not a WAV means the bytes are already the file. */
export async function wavSourceFacts(
  blob: Blob
): Promise<{ channels: number; source: AudioSource }> {
  const encoded = { channels: 1, source: 'encoded' as const };
  const read = async (offset: number, length: number) => {
    if (offset < 0 || length <= 0 || offset + length > blob.size) return;
    return new DataView(
      await blob.slice(offset, offset + length).arrayBuffer()
    );
  };
  const head = await read(0, 12);
  if (
    !head ||
    head.getUint32(0, false) !== 0x52494646 ||
    head.getUint32(8, false) !== 0x57415645
  ) {
    return encoded;
  }
  let offset = 12;
  while (offset + 8 <= blob.size) {
    const chunk = await read(offset, 8);
    if (!chunk) break;
    const id = chunk.getUint32(0, false);
    const size = chunk.getUint32(4, true);
    const data = offset + 8;
    if (size > blob.size - data) break;
    if (id === 0x666d7420 && size >= 16) {
      const fmt = await read(data, 4);
      if (!fmt) break;
      const format = fmt.getUint16(0, true);
      const channels = fmt.getUint16(2, true) >= 2 ? 2 : 1;
      return { channels, source: format === 3 ? 'float32' : 'pcm' };
    }
    const padded = size + (size & 1);
    if (padded > blob.size - data) break;
    offset = data + padded;
  }
  return encoded;
}

/**
 * Expected upload size before the encode exists.
 * `compression` is how many times smaller a mono upload is than 16-bit PCM.
 * 1 uploads that file as-is. Live bytes are one channel, so channel count is
 * applied here; a file's length already includes every channel.
 * A stereo encode is 96 kbps, 1.5 times the mono upload for the same duration.
 * An encoded blob is priced at its own size.
 */
export function estimatedUploadBytes(
  sourceBytes: number,
  compression: number,
  options: { source: AudioSource; channels?: number }
): number {
  const { source, channels = 1 } = options;
  const ratio = compression > 0 ? compression : 1;
  const count = channels >= 2 ? 2 : 1;
  const compressed = (pcm16Bytes: number) => {
    const effectiveRatio =
      count === 1 ? ratio : (ratio * count) / STEREO_BITRATE_OVER_MONO;
    return (pcm16Bytes / effectiveRatio) * OPUS_ESTIMATE_HEADROOM;
  };
  switch (source) {
    case 'encoded':
      return sourceBytes;
    case 'float32':
      if (ratio === 1) return sourceBytes;
      return compressed(sourceBytes / 2);
    case 'pcm':
      if (ratio === 1) return sourceBytes;
      return compressed(sourceBytes);
    case 'live':
      if (ratio === 1) return sourceBytes * 2 * count;
      return compressed(sourceBytes * count);
  }
}
