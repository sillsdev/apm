import { convertToWav } from './wav';

/** Index of the channel with the most energy (first channel on ties). */
export function loudestChannelIndex(buffer: AudioBuffer): number {
  let best = 0;
  let bestEnergy = -1;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    let energy = 0;
    for (const sample of buffer.getChannelData(ch)) energy += sample * sample;
    if (energy > bestEnergy) {
      best = ch;
      bestEnergy = energy;
    }
  }
  return best;
}

/** Encodes an AudioBuffer to a WAV Blob. */
export async function audioBufferToWavBlob(buffer: AudioBuffer): Promise<Blob> {
  if (buffer.length === 0) {
    return new Blob([], { type: 'audio/wav' });
  }

  // Beyond stereo is a multi-input interface (TT-7805): the voice may be on any
  // channel, so save the loudest one as mono.
  if (buffer.numberOfChannels > 2) {
    return convertToWav(
      buffer.getChannelData(loudestChannelIndex(buffer)),
      null,
      { isFloat: true, numChannels: 1, sampleRate: buffer.sampleRate }
    );
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
