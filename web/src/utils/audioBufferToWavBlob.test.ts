import {
  audioBufferToWavBlob,
  loudestChannelIndex,
} from './audioBufferToWavBlob';

const WAV_HEADER_BYTES = 44;
const WAV_CHANNELS_OFFSET = 22;

function buffer(channels: number[][], sampleRate = 48000): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    length: channels[0].length,
    sampleRate,
    getChannelData: (ch: number) => Float32Array.from(channels[ch]),
  } as unknown as AudioBuffer;
}

async function decodeWav(blob: Blob) {
  const view = new DataView(await blob.arrayBuffer());
  return {
    channels: view.getUint16(WAV_CHANNELS_OFFSET, true),
    samples: Array.from(
      new Float32Array(view.buffer.slice(WAV_HEADER_BYTES) as ArrayBuffer)
    ),
  };
}

describe('loudestChannelIndex', () => {
  it('picks the channel with the most energy', () => {
    expect(
      loudestChannelIndex(
        buffer([
          [0, 0],
          [0.1, -0.1],
          [0.5, -0.5],
          [0, 0],
        ])
      )
    ).toBe(2);
  });

  it('keeps the first channel when all are silent', () => {
    expect(loudestChannelIndex(buffer([[0], [0], [0], [0]]))).toBe(0);
  });
});

describe('audioBufferToWavBlob', () => {
  // TT-7805: 4-channel interface with the voice on channel 3 only.
  it('saves the loudest channel as mono for a 4-channel take', async () => {
    const wav = await decodeWav(
      await audioBufferToWavBlob(
        buffer([
          [0, 0],
          [0, 0],
          [0.5, -0.5],
          [0, 0],
        ])
      )
    );
    expect(wav.channels).toBe(1);
    expect(wav.samples).toEqual([0.5, -0.5]);
  });

  it('keeps a stereo take stereo', async () => {
    const wav = await decodeWav(
      await audioBufferToWavBlob(
        buffer([
          [0.25, 0.25],
          [0.5, 0.5],
        ])
      )
    );
    expect(wav.channels).toBe(2);
    expect(wav.samples).toEqual([0.25, 0.5, 0.25, 0.5]);
  });
});
