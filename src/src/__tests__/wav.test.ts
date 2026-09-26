import { encodeWAV, convertToWav, WaveOptions } from '../utils/wav';

function readString(dv: DataView, offset: number, length: number): string {
  let s = '';
  for (let i = 0; i < length; i++) {
    s += String.fromCharCode(dv.getUint8(offset + i));
  }
  return s;
}

describe('wav helpers', () => {
  test('encodeWAV produces valid RIFF/WAVE header (stereo)', () => {
    const left = Float32Array.from([0, 0.5]);
    const right = Float32Array.from([0, 0.5]);
    const dv = encodeWAV(2, 44100, left, right);

    // Basic identifiers
    expect(readString(dv, 0, 4)).toBe('RIFF');
    expect(readString(dv, 8, 4)).toBe('WAVE');
    expect(readString(dv, 12, 4)).toBe('fmt ');
    expect(readString(dv, 36, 4)).toBe('data');

    // Channels
    expect(dv.getUint16(22, true)).toBe(2);
    // Sample rate
    expect(dv.getUint32(24, true)).toBe(44100);
    // Bits per sample
    expect(dv.getUint16(34, true)).toBe(16);

    // Data length = interleaved samples * 2 bytes
    const interleavedSamples = left.length + right.length;
    expect(dv.getUint32(40, true)).toBe(interleavedSamples * 2);

    // First few PCM samples (44 onwards) — first sample should be 0
    expect(dv.getInt16(44, true)).toBe(0);
    // Second sample corresponds to right[0] which is 0
    expect(dv.getInt16(46, true)).toBe(0);
    // Third sample (left[1] = 0.5) should be roughly half scale (~16383)
    const third = dv.getInt16(48, true);
    expect(third).toBeGreaterThan(8000);
    expect(third).toBeLessThan(20000);
  });

  test('convertToWav generates mono WAV Blob with correct metadata', async () => {
    const samples = Uint16Array.from([0, 1000, 2000]);
    const options: WaveOptions = {
      isFloat: false,
      numChannels: 1,
      sampleRate: 16000,
    };
    const blob = await convertToWav(samples, null, options);
    expect(blob.type).toBe('audio/wav');
    const arrayBuffer = await blob.arrayBuffer();
    const dv = new DataView(arrayBuffer);

    expect(readString(dv, 0, 4)).toBe('RIFF');
    expect(readString(dv, 8, 4)).toBe('WAVE');
    expect(dv.getUint16(22, true)).toBe(1); // mono
    expect(dv.getUint32(24, true)).toBe(16000);
    // ByteRate = sampleRate * numChannels * bytesPerSample
    expect(dv.getUint32(28, true)).toBe(16000 * 1 * 2);
    // BlockAlign
    expect(dv.getUint16(32, true)).toBe(2);
    // Bits per sample
    expect(dv.getUint16(34, true)).toBe(16);
    // Data size (numFrames * blockAlign) = 3 * 2 = 6
    expect(dv.getUint32(40, true)).toBe(6);
    // Total file size = 44 + 6 = 50
    expect(arrayBuffer.byteLength).toBe(50);
  });
});
