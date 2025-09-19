export interface WaveOptions {
  isFloat: boolean;
  numChannels: number;
  sampleRate: number;
  numFrames?: number;
}
type SampleArray = Float32Array | Uint16Array;

export function encodeWAV(
  numChannels: number,
  sampleRate: number,
  data_left: SampleArray,
  data_right: SampleArray | null | undefined
): DataView {
  function writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }
  function floatTo16BitPCM(
    output: DataView,
    offset: number,
    input: ArrayLike<number>
  ): void {
    for (let i = 0; i < input.length; i++, offset += 2) {
      const sample = input[i] ?? 0;
      const s = Math.max(-1, Math.min(1, sample));
      output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
  }
  const samples = interleave(data_left, data_right, {
    isFloat: true, // floating point or 16-bit integer (WebAudio API decodes to Float32Array)
    numChannels,
    sampleRate,
  });
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  floatTo16BitPCM(view, 44, samples);

  return view;
}

export async function convertToWav(
  data_left: SampleArray,
  data_right: SampleArray | null | undefined,
  options: WaveOptions
): Promise<Blob> {
  const interleaved = interleave(data_left, data_right, options);
  // Ensure we have a standalone ArrayBuffer (not SharedArrayBuffer) by copying
  const pcmBuffer = new ArrayBuffer(interleaved.byteLength);
  new Uint8Array(pcmBuffer).set(
    new Uint8Array(
      interleaved.buffer as ArrayBuffer, // cast acceptable for copying
      interleaved.byteOffset,
      interleaved.byteLength
    )
  );
  const wavBytes = getWavBytes(pcmBuffer, options);
  // Create a copy as a plain ArrayBuffer for Blob compatibility
  const safeBuffer = new ArrayBuffer(wavBytes.byteLength);
  new Uint8Array(safeBuffer).set(wavBytes);
  return new Blob([safeBuffer], { type: 'audio/wav' });
}

const interleave = (
  left: SampleArray,
  right: SampleArray | null | undefined,
  options: WaveOptions
): SampleArray => {
  if (right) {
    const TypeCtor = options.isFloat ? Float32Array : Uint16Array;
    const interleaved = new TypeCtor(left.length + right.length);
    for (let src = 0, dst = 0; src < left.length; src++, dst += 2) {
      interleaved[dst] = left[src] ?? 0;
      interleaved[dst + 1] = right[src] ?? 0;
    }
    return interleaved;
  }
  return left;
};

// Returns Uint8Array of WAV bytes
function getWavBytes(buffer: ArrayBuffer, options: WaveOptions): Uint8Array {
  const TypeCtor = options.isFloat ? Float32Array : Uint16Array;
  options.numFrames = buffer.byteLength / TypeCtor.BYTES_PER_ELEMENT;
  const headerBytes = getWavHeader(options);
  const wavBytes = new Uint8Array(headerBytes.length + buffer.byteLength);
  wavBytes.set(headerBytes, 0);
  wavBytes.set(new Uint8Array(buffer), headerBytes.length);
  return wavBytes;
}

// adapted from https://gist.github.com/also/900023
// returns Uint8Array of WAV header bytes
function getWavHeader(options: WaveOptions): Uint8Array {
  const numFrames = options.numFrames || 0;
  const numChannels = options.numChannels || 2;
  const sampleRate = options.sampleRate || 44100;
  const bytesPerSample = options.isFloat ? 4 : 2;
  const format = options.isFloat ? 3 : 1;

  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;

  const buffer = new ArrayBuffer(44);
  const dv = new DataView(buffer);

  let p = 0;

  function writeString(s: string): void {
    for (let i = 0; i < s.length; i++) {
      dv.setUint8(p + i, s.charCodeAt(i));
    }
    p += s.length;
  }

  function writeUint32(d: number): void {
    dv.setUint32(p, d, true);
    p += 4;
  }

  function writeUint16(d: number): void {
    dv.setUint16(p, d, true);
    p += 2;
  }

  writeString('RIFF'); // ChunkID
  writeUint32(dataSize + 36); // ChunkSize
  writeString('WAVE'); // Format
  writeString('fmt '); // Subchunk1ID
  writeUint32(16); // Subchunk1Size
  writeUint16(format); // AudioFormat
  writeUint16(numChannels); // NumChannels
  writeUint32(sampleRate); // SampleRate
  writeUint32(byteRate); // ByteRate
  writeUint16(blockAlign); // BlockAlign
  writeUint16(bytesPerSample * 8); // BitsPerSample
  writeString('data'); // Subchunk2ID
  writeUint32(dataSize); // Subchunk2Size

  return new Uint8Array(buffer);
}
