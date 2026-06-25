import { convertToWav } from './wav';

/** Encodes an AudioBuffer to a WAV Blob. */
export async function audioBufferToWavBlob(
  buffer: AudioBuffer
): Promise<Blob> {
  if (buffer.length === 0) {
    return new Blob([], { type: 'audio/wav' });
  }

  // convertToWav only interleaves left/right; clamp so header matches PCM layout.
  const numChannels = Math.min(2, buffer.numberOfChannels);
  const leftChannel = buffer.getChannelData(0);
  const rightChannel = numChannels > 1 ? buffer.getChannelData(1) : null;
  return convertToWav(leftChannel, rightChannel, {
    isFloat: true,
    numChannels,
    sampleRate: buffer.sampleRate,
  });
}
