import { audioBufferToWavBlob } from './audioBufferToWavBlob';
import {
  clipAudio,
  insertSilenceAudio,
  normalizeAudio,
  replaceAudioSegment,
  spliceAudio,
} from './audioUtils';

// jsdom has no Web Audio. The fakes decode the float WAV that
// audioBufferToWavBlob writes, so each test round-trips real WAV bytes.

const RATE = 10; // 1 sample = 0.1 s
const WAV_HEADER_BYTES = 44;
const WAV_CHANNELS_OFFSET = 22;
const WAV_SAMPLE_RATE_OFFSET = 24;

/** Samples in sixteenths, which float32 stores exactly. */
const s = (...ns: number[]) => ns.map((n) => n / 16);
const ONE_SECOND = s(1, 2, 3, 4, 5, 6, 7, 8, 9, 10);

class FakeAudioBuffer {
  private channels: Float32Array[];
  constructor(
    public numberOfChannels: number,
    public length: number,
    public sampleRate: number
  ) {
    this.channels = Array.from(
      { length: numberOfChannels },
      () => new Float32Array(length)
    );
  }
  get duration() {
    return this.length / this.sampleRate;
  }
  getChannelData(ch: number) {
    return this.channels[ch];
  }
}

function decodeWav(bytes: ArrayBuffer): FakeAudioBuffer {
  const view = new DataView(bytes);
  const numChannels = view.getUint16(WAV_CHANNELS_OFFSET, true);
  const interleaved = new Float32Array(bytes.slice(WAV_HEADER_BYTES));
  const audio = new FakeAudioBuffer(
    numChannels,
    interleaved.length / numChannels,
    view.getUint32(WAV_SAMPLE_RATE_OFFSET, true)
  );
  interleaved.forEach((sample, i) => {
    audio.getChannelData(i % numChannels)[Math.floor(i / numChannels)] = sample;
  });
  return audio;
}

class FakeAudioContext {
  async decodeAudioData(bytes: ArrayBuffer) {
    return decodeWav(bytes);
  }
  async close() {
    /* nothing to release */
  }
}

/**
 * Renders its one source at the context's rate and channel count:
 * nearest-sample resampling, and mono copied to every channel.
 */
class FakeOfflineAudioContext {
  destination = {};
  private input: FakeAudioBuffer | undefined;
  constructor(
    private channels: number,
    private length: number,
    public sampleRate: number
  ) {}
  createBuffer(channels: number, length: number, rate: number) {
    return new FakeAudioBuffer(channels, length, rate);
  }
  createBufferSource() {
    const source = {
      buffer: undefined as FakeAudioBuffer | undefined,
      connect: () => undefined,
      start: () => {
        this.input = source.buffer;
      },
    };
    return source;
  }
  async startRendering() {
    const out = new FakeAudioBuffer(
      this.channels,
      this.length,
      this.sampleRate
    );
    const src = this.input!;
    for (let ch = 0; ch < this.channels; ch++) {
      const from = src.getChannelData(Math.min(ch, src.numberOfChannels - 1));
      const to = out.getChannelData(ch);
      for (let i = 0; i < this.length; i++) {
        to[i] =
          from[
            Math.min(
              from.length - 1,
              Math.floor((i * src.sampleRate) / this.sampleRate)
            )
          ];
      }
    }
    return out;
  }
}

/** Encode channels of samples as a WAV Blob. */
function wav(channels: number[][], sampleRate = RATE): Promise<Blob> {
  const audio = new FakeAudioBuffer(
    channels.length,
    channels[0].length,
    sampleRate
  );
  channels.forEach((samples, ch) => audio.getChannelData(ch).set(samples));
  return audioBufferToWavBlob(audio as unknown as AudioBuffer);
}

async function read(blob: Blob) {
  const audio = decodeWav(await blob.arrayBuffer());
  return {
    sampleRate: audio.sampleRate,
    channels: Array.from({ length: audio.numberOfChannels }, (_, ch) =>
      Array.from(audio.getChannelData(ch))
    ),
  };
}

const g = globalThis as unknown as Record<string, unknown>;
const saved = {
  AudioContext: g.AudioContext,
  OfflineAudioContext: g.OfflineAudioContext,
};

beforeEach(() => {
  g.AudioContext = FakeAudioContext;
  g.OfflineAudioContext = FakeOfflineAudioContext;
});

afterEach(() => {
  Object.assign(g, saved);
});

describe('spliceAudio', () => {
  it('removes the selected range and keeps the audio on either side', async () => {
    const out = await spliceAudio(await wav([ONE_SECOND]), 0.3, 0.7);
    expect(await read(out)).toEqual({
      sampleRate: RATE,
      channels: [s(1, 2, 3, 8, 9, 10)],
    });
  });
});

describe('clipAudio', () => {
  it('keeps only the selected range', async () => {
    const out = await clipAudio(await wav([ONE_SECOND]), 0.3, 0.7);
    expect(await read(out)).toEqual({
      sampleRate: RATE,
      channels: [s(4, 5, 6, 7)],
    });
  });
});

describe('insertSilenceAudio', () => {
  it('inserts silence at the given time and shifts the rest later', async () => {
    const out = await insertSilenceAudio(await wav([ONE_SECOND]), 0.3, 0.2);
    expect(await read(out)).toEqual({
      sampleRate: RATE,
      channels: [s(1, 2, 3, 0, 0, 4, 5, 6, 7, 8, 9, 10)],
    });
  });
});

describe('replaceAudioSegment', () => {
  it('swaps a range for shorter replacement audio', async () => {
    const { blob, replacementDuration } = await replaceAudioSegment(
      await wav([ONE_SECOND]),
      0.3,
      0.7,
      await wav([s(11, 12)])
    );
    expect(await read(blob)).toEqual({
      sampleRate: RATE,
      channels: [s(1, 2, 3, 11, 12, 8, 9, 10)],
    });
    expect(replacementDuration).toBeCloseTo(0.2);
  });

  it('swaps a range for longer replacement audio', async () => {
    const { blob, replacementDuration } = await replaceAudioSegment(
      await wav([ONE_SECOND]),
      0.4,
      0.5,
      await wav([s(11, 12, 13)])
    );
    expect((await read(blob)).channels).toEqual([
      s(1, 2, 3, 4, 11, 12, 13, 6, 7, 8, 9, 10),
    ]);
    expect(replacementDuration).toBeCloseTo(0.3);
  });

  it('renders a replacement at another sample rate to the take rate', async () => {
    const { blob, replacementDuration } = await replaceAudioSegment(
      await wav([ONE_SECOND]),
      0.3,
      0.7,
      await wav([s(11, 12, 13)], RATE / 2)
    );
    // The fake resamples nearest-sample, so each sample appears twice.
    expect(await read(blob)).toEqual({
      sampleRate: RATE,
      channels: [s(1, 2, 3, 11, 11, 12, 12, 13, 13, 8, 9, 10)],
    });
    expect(replacementDuration).toBeCloseTo(0.6);
  });

  it('puts a mono replacement on both channels of a stereo take', async () => {
    const right = ONE_SECOND.map((n) => -n);
    const { blob } = await replaceAudioSegment(
      await wav([ONE_SECOND, right]),
      0.3,
      0.7,
      await wav([s(11, 12)])
    );
    expect((await read(blob)).channels).toEqual([
      s(1, 2, 3, 11, 12, 8, 9, 10),
      s(-1, -2, -3, 11, 12, -8, -9, -10),
    ]);
  });
});

const LOUD_RATE = 48000;

// ITU BS.1770 reads a full-scale 1 kHz sine in one channel as -3.01 LUFS, so
// normalized to -23 LUFS its peak is -19.99 dB.
const SINE_PEAK_DB = -23 + 3.01;

/** A 1 kHz sine for `seconds`, then `silence` seconds of zeros. */
function sine(amplitude: number, seconds: number, silence = 0): number[] {
  const tone = Math.round(seconds * LOUD_RATE);
  const length = tone + Math.round(silence * LOUD_RATE);
  return Array.from({ length }, (_, i) =>
    i < tone ? amplitude * Math.sin((2 * Math.PI * 1000 * i) / LOUD_RATE) : 0
  );
}

const peakDb = (samples: number[]) =>
  20 * Math.log10(samples.reduce((a, b) => Math.max(a, Math.abs(b)), 0));

/** The channels normalizeAudio returns, or undefined if it returns none. */
async function normalized(
  channels: number[][],
  startSec?: number,
  endSec?: number
) {
  const out = await normalizeAudio(
    await wav(channels, LOUD_RATE),
    startSec,
    endSec
  );
  return out && (await read(out)).channels;
}

describe('normalizeAudio', () => {
  it('brings a quiet sine to -23 LUFS', async () => {
    const [ch] = (await normalized([sine(0.001, 3)]))!;
    expect(peakDb(ch)).toBeCloseTo(SINE_PEAK_DB, 1);
  });

  it('adds the loudness of both stereo channels', async () => {
    const tone = sine(0.001, 3);
    const [left, right] = (await normalized([tone, tone]))!;
    // Two channels measure 3.01 dB louder than one, so each ends 3.01 dB lower.
    expect(peakDb(left)).toBeCloseTo(SINE_PEAK_DB - 3.01, 1);
    expect(peakDb(right)).toBeCloseTo(SINE_PEAK_DB - 3.01, 1);
  });

  it('ignores silence when measuring', async () => {
    const [short] = (await normalized([sine(0.001, 2, 1)]))!;
    const [long] = (await normalized([sine(0.001, 2, 5)]))!;
    expect(peakDb(long)).toBeCloseTo(peakDb(short), 5);
  });

  it('measures audio shorter than 400 ms as one block', async () => {
    const [ch] = (await normalized([sine(0.001, 0.2)]))!;
    expect(peakDb(ch)).toBeCloseTo(SINE_PEAK_DB, 0);
  });

  it('changes only the given range', async () => {
    const [ch] = (await normalized([sine(0.001, 2)], 1, 2))!;
    expect(ch.slice(0, LOUD_RATE)).toEqual(sine(0.001, 1).map(Math.fround));
    expect(peakDb(ch.slice(LOUD_RATE))).toBeCloseTo(SINE_PEAK_DB, 1);
  });

  it('lowers the gain to keep peaks at -2 dB', async () => {
    // One click in a second of silence measures far below -23 LUFS, so
    // reaching -23 would push the click past 0 dB.
    const click = new Array(LOUD_RATE).fill(0);
    click[LOUD_RATE / 2] = 0.5;
    const [ch] = (await normalized([click]))!;
    expect(peakDb(ch)).toBeCloseTo(-2, 3);
  });

  it('is undefined for silence', async () => {
    expect(await normalized([new Array(LOUD_RATE).fill(0)])).toBeUndefined();
  });
});
