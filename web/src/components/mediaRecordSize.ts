/** Mono 16-bit PCM at WavRecorder's 48 kHz. Live estimate before the blob exists. */
export const RECORD_PCM16_BYTES_PER_SECOND = 48_000 * 2;

/**
 * Expected upload size.
 * Editor takes are mono float32 WAV (4 bytes/sample). `compression` is how many
 * times smaller the upload is than 16-bit PCM; 1 means the float32 WAV is uploaded.
 * ponytail: fixed ratio, not a measured encode. Upgrade path is the converted blob.
 */
export function estimatedUploadBytes(
  sourceBytes: number,
  compression: number,
  sourceIsFloat32Wav: boolean
): number {
  const ratio = compression > 0 ? compression : 1;
  if (ratio === 1) {
    return sourceIsFloat32Wav ? sourceBytes : sourceBytes * 2;
  }
  const pcm16Bytes = sourceIsFloat32Wav ? sourceBytes / 2 : sourceBytes;
  return pcm16Bytes / ratio;
}
