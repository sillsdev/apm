import { convertToWav } from './wav';
import {
  OPUS_MONO_COMPRESSION,
  RECORD_PCM16_BYTES_PER_SECOND,
  estimatedUploadBytes,
  wavChannelCount,
} from './mediaRecordSize';

describe('estimatedUploadBytes', () => {
  const minute = 57 * 60;

  it('keeps a 57 minute mono float32 take under a 30 MB compressed limit', () => {
    const float32Wav = minute * 48_000 * 4;
    const estimated = estimatedUploadBytes(float32Wav, OPUS_MONO_COMPRESSION, {
      sourceIsFloat32Wav: true,
    });
    expect(estimated / 1_000_000).toBeCloseTo(27.36, 2);
    expect(estimated).toBeLessThan(30 * 1_000_000);
  });

  it('prices a 64 kbps file of 43309332 bytes over a 30 MB limit', () => {
    const encoded = 43_309_332;
    const float32Wav = encoded * OPUS_MONO_COMPRESSION * 2;
    expect(
      estimatedUploadBytes(float32Wav, OPUS_MONO_COMPRESSION, {
        sourceIsFloat32Wav: true,
      })
    ).toBe(encoded);
    expect(encoded).toBeGreaterThan(30 * 1_000_000);
  });

  it('matches that estimate from the live 16-bit rate', () => {
    const pcm16 = minute * RECORD_PCM16_BYTES_PER_SECOND;
    expect(
      estimatedUploadBytes(pcm16, OPUS_MONO_COMPRESSION, {
        sourceIsFloat32Wav: false,
      })
    ).toBe(
      estimatedUploadBytes(minute * 48_000 * 4, OPUS_MONO_COMPRESSION, {
        sourceIsFloat32Wav: true,
      })
    );
  });

  it('counts a saved WAV as the float32 file', () => {
    const float32Wav = minute * 48_000 * 4;
    expect(
      estimatedUploadBytes(float32Wav, 1, { sourceIsFloat32Wav: true })
    ).toBe(float32Wav);
  });

  it('prices a stereo take at 1.5 times mono for the same duration', () => {
    const monoFloat32 = 60 * 48_000 * 4;
    const mono = estimatedUploadBytes(monoFloat32, OPUS_MONO_COMPRESSION, {
      sourceIsFloat32Wav: true,
      channels: 1,
    });
    const stereo = estimatedUploadBytes(
      monoFloat32 * 2,
      OPUS_MONO_COMPRESSION,
      { sourceIsFloat32Wav: true, channels: 2 }
    );
    expect(stereo).toBe(mono * 1.5);
  });

  it('reads two channels from an editor WAV header', async () => {
    const blob = await convertToWav(new Float32Array(8), new Float32Array(8), {
      isFloat: true,
      numChannels: 2,
      sampleRate: 48_000,
    });
    expect(await wavChannelCount(blob)).toBe(2);
  });
});
