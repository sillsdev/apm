import {
  RECORD_PCM16_BYTES_PER_SECOND,
  estimatedUploadBytes,
} from './mediaRecordSize';

describe('estimatedUploadBytes', () => {
  const minute = 57 * 60;

  it('keeps a 57 minute mono float32 take under a 30 MB compressed limit', () => {
    const float32Wav = minute * 48_000 * 4;
    const estimated = estimatedUploadBytes(float32Wav, 20, true);
    expect(estimated / 1_000_000).toBeCloseTo(16.416, 3);
    expect(estimated).toBeLessThan(30 * 1_000_000);
  });

  it('matches that estimate from the live 16-bit rate', () => {
    const pcm16 = minute * RECORD_PCM16_BYTES_PER_SECOND;
    expect(estimatedUploadBytes(pcm16, 20, false)).toBe(
      estimatedUploadBytes(minute * 48_000 * 4, 20, true)
    );
  });

  it('counts a saved WAV as the float32 file', () => {
    const float32Wav = minute * 48_000 * 4;
    expect(estimatedUploadBytes(float32Wav, 1, true)).toBe(float32Wav);
  });
});
