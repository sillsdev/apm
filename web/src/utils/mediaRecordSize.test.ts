import { convertToWav } from './wav';
import {
  OPUS_ESTIMATE_HEADROOM,
  OPUS_MONO_COMPRESSION,
  RECORD_PCM16_BYTES_PER_SECOND,
  estimatedUploadBytes,
  wavSourceFacts,
} from './mediaRecordSize';

describe('estimatedUploadBytes', () => {
  const minute = 57 * 60;

  it('keeps a 57 minute mono float32 take under a 30 MB compressed limit', () => {
    const float32Wav = minute * 48_000 * 4;
    const estimated = estimatedUploadBytes(float32Wav, OPUS_MONO_COMPRESSION, {
      source: 'float32',
    });
    expect(estimated / 1_000_000).toBeCloseTo(28.73, 2);
    expect(estimated).toBeLessThan(30 * 1_000_000);
  });

  it('prices a 64 kbps file above its exact size so a near-limit take is held back', () => {
    const encoded = 43_309_332;
    const float32Wav = encoded * OPUS_MONO_COMPRESSION * 2;
    expect(
      estimatedUploadBytes(float32Wav, OPUS_MONO_COMPRESSION, {
        source: 'float32',
      })
    ).toBe(encoded * OPUS_ESTIMATE_HEADROOM);
    expect(encoded).toBeGreaterThan(30 * 1_000_000);
  });

  it('matches that estimate from the live 16-bit rate', () => {
    const pcm16 = minute * RECORD_PCM16_BYTES_PER_SECOND;
    expect(
      estimatedUploadBytes(pcm16, OPUS_MONO_COMPRESSION, { source: 'live' })
    ).toBe(
      estimatedUploadBytes(minute * 48_000 * 4, OPUS_MONO_COMPRESSION, {
        source: 'float32',
      })
    );
    const mono = estimatedUploadBytes(pcm16, OPUS_MONO_COMPRESSION, {
      source: 'live',
    });
    expect(
      estimatedUploadBytes(pcm16, OPUS_MONO_COMPRESSION, {
        source: 'live',
        channels: 2,
      })
    ).toBe(mono * 1.5);
  });

  it('counts a saved WAV as the float32 file', () => {
    const float32Wav = minute * 48_000 * 4;
    expect(estimatedUploadBytes(float32Wav, 1, { source: 'float32' })).toBe(
      float32Wav
    );
  });

  it('prices a 16-bit stereo WAV the same as float32 of that duration', () => {
    const samples = 60 * 48_000;
    const pcm16 = samples * 2 * 2;
    const float32 = samples * 4 * 2;
    expect(
      estimatedUploadBytes(pcm16, OPUS_MONO_COMPRESSION, {
        source: 'pcm',
        channels: 2,
      })
    ).toBe(
      estimatedUploadBytes(float32, OPUS_MONO_COMPRESSION, {
        source: 'float32',
        channels: 2,
      })
    );
  });

  it('counts a 16-bit WAV as that file when saving uncompressed', () => {
    const stereo = 60 * 48_000 * 2 * 2;
    const mono = 60 * 48_000 * 2;
    expect(
      estimatedUploadBytes(stereo, 1, { source: 'pcm', channels: 2 })
    ).toBe(stereo);
    expect(estimatedUploadBytes(mono, 1, { source: 'pcm' })).toBe(mono);
  });

  it('prices a stereo take at 1.5 times mono for the same duration', () => {
    const monoFloat32 = 60 * 48_000 * 4;
    const mono = estimatedUploadBytes(monoFloat32, OPUS_MONO_COMPRESSION, {
      source: 'float32',
      channels: 1,
    });
    const stereo = estimatedUploadBytes(
      monoFloat32 * 2,
      OPUS_MONO_COMPRESSION,
      { source: 'float32', channels: 2 }
    );
    expect(stereo).toBe(mono * 1.5);
  });

  it('prices an ogg or mp3 at its own size', () => {
    expect(
      estimatedUploadBytes(20_000_000, OPUS_MONO_COMPRESSION, {
        source: 'encoded',
      })
    ).toBe(20_000_000);
  });

  it('reads a float32 editor WAV and treats anything else as already encoded', async () => {
    const blob = await convertToWav(new Float32Array(8), new Float32Array(8), {
      isFloat: true,
      numChannels: 2,
      sampleRate: 48_000,
    });
    expect(await wavSourceFacts(blob)).toEqual({
      channels: 2,
      source: 'float32',
    });
    expect(
      await wavSourceFacts(
        new Blob([new Uint8Array(32)], { type: 'audio/ogg' })
      )
    ).toEqual({ channels: 1, source: 'encoded' });
  });

  it('reads fmt after a JUNK chunk instead of the bytes at a fixed offset', async () => {
    const junk = 4;
    const fmtAt = 12 + 8 + junk;
    const bytes = new Uint8Array(fmtAt + 8 + 16);
    const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x52494646, false);
    view.setUint32(8, 0x57415645, false);
    view.setUint32(12, 0x4a554e4b, false);
    view.setUint32(16, junk, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(fmtAt, 0x666d7420, false);
    view.setUint32(fmtAt + 4, 16, true);
    view.setUint16(fmtAt + 8, 3, true);
    view.setUint16(fmtAt + 10, 2, true);
    expect(
      await wavSourceFacts(new Blob([bytes], { type: 'audio/wav' }))
    ).toEqual({ channels: 2, source: 'float32' });

    const shortFmt = new Uint8Array(12 + 8 + 4);
    const shortView = new DataView(shortFmt.buffer);
    shortView.setUint32(0, 0x52494646, false);
    shortView.setUint32(8, 0x57415645, false);
    shortView.setUint32(12, 0x666d7420, false);
    shortView.setUint32(16, 4, true);
    shortView.setUint16(20, 3, true);
    shortView.setUint16(22, 2, true);
    expect(
      await wavSourceFacts(new Blob([shortFmt], { type: 'audio/wav' }))
    ).toEqual({ channels: 1, source: 'encoded' });
  });
});
