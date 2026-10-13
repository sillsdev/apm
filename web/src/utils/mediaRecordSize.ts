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

/** float32 is an editor WAV. pcm is 16-bit WAV or live capture. encoded is ogg/mp3. */
export type AudioSource = 'float32' | 'pcm' | 'encoded';

/** Channel count and how to price the blob. Not a WAV means the bytes are already the file. */
export async function wavSourceFacts(
  blob: Blob
): Promise<{ channels: number; source: AudioSource }> {
  if (blob.size < 24) return { channels: 1, source: 'encoded' };
  const header = new DataView(await blob.slice(0, 24).arrayBuffer());
  const riff = header.getUint32(0, false);
  const wave = header.getUint32(8, false);
  if (riff !== 0x52494646 || wave !== 0x57415645) {
    return { channels: 1, source: 'encoded' };
  }
  const format = header.getUint16(20, true);
  const channels = header.getUint16(22, true) >= 2 ? 2 : 1;
  return { channels, source: format === 3 ? 'float32' : 'pcm' };
}

/**
 * Expected upload size before the encode exists.
 * Editor takes are float32 WAV (4 bytes/sample). `compression` is how many times
 * smaller a mono upload is than 16-bit PCM; 1 means the float32 WAV is uploaded.
 * A stereo pair is 96 kbps, so the same duration is 1.5 times the mono upload.
 * An encoded blob is priced at its own size.
 */
export function estimatedUploadBytes(
  sourceBytes: number,
  compression: number,
  options: { source: AudioSource; channels?: number }
): number {
  const { source, channels = 1 } = options;
  if (source === 'encoded') return sourceBytes;
  const sourceIsFloat32Wav = source === 'float32';
  const ratio = compression > 0 ? compression : 1;
  const count = channels >= 2 ? 2 : 1;
  if (ratio === 1) {
    return sourceIsFloat32Wav ? sourceBytes : sourceBytes * 2 * count;
  }
  const pcm16Bytes = sourceIsFloat32Wav ? sourceBytes / 2 : sourceBytes * count;
  const effectiveRatio =
    count === 1 ? ratio : (ratio * count) / STEREO_BITRATE_OVER_MONO;
  return (pcm16Bytes / effectiveRatio) * OPUS_ESTIMATE_HEADROOM;
}
