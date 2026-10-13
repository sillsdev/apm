/** Mono 16-bit PCM at WavRecorder's 48 kHz. Live estimate before the blob exists. */
export const RECORD_PCM16_BYTES_PER_SECOND = 48_000 * 2;

/** Opusenc's default is 64 kbps. Mono 16-bit 48 kHz is 768 kbps, so 768/64. */
export const OPUS_MONO_COMPRESSION = 12;

/** Coupled stereo defaults to 96 kbps, 1.5 times the mono stream. */
const STEREO_BITRATE_OVER_MONO = 96 / 64;

/** Channel count from an editor WAV, or 1 when the blob is not a WAV. */
export async function wavChannelCount(blob: Blob): Promise<number> {
  if (blob.size < 24) return 1;
  const header = new DataView(await blob.slice(0, 24).arrayBuffer());
  const riff = header.getUint32(0, false);
  const wave = header.getUint32(8, false);
  if (riff !== 0x52494646 || wave !== 0x45564145) return 1;
  return header.getUint16(22, true) >= 2 ? 2 : 1;
}

/**
 * Expected upload size before the encode exists.
 * Editor takes are float32 WAV (4 bytes/sample). `compression` is how many times
 * smaller a mono upload is than 16-bit PCM; 1 means the float32 WAV is uploaded.
 * A stereo pair is 96 kbps, so the same duration is 1.5 times the mono upload.
 * ponytail: fixed 64/96 kbps ratio, not a measured encode. Loose gate against huge files.
 */
export function estimatedUploadBytes(
  sourceBytes: number,
  compression: number,
  sourceIsFloat32Wav: boolean,
  channels = 1
): number {
  const ratio = compression > 0 ? compression : 1;
  const count = channels >= 2 ? 2 : 1;
  if (ratio === 1) {
    return sourceIsFloat32Wav ? sourceBytes : sourceBytes * 2 * count;
  }
  const pcm16Bytes = sourceIsFloat32Wav ? sourceBytes / 2 : sourceBytes * count;
  const effectiveRatio =
    count === 1 ? ratio : (ratio * count) / STEREO_BITRATE_OVER_MONO;
  return pcm16Bytes / effectiveRatio;
}
