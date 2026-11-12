// TT-7805: Chrome on macOS feeds silence from a MediaStreamAudioSourceNode when
// the AudioContext rate differs from the mic track's rate (e.g. 48 kHz context,
// 44.1 kHz USB mic). The fakes below model that so the saved take is all zeros
// unless WavRecorder captures at the track's own rate.

jest.mock('../audioDiagnostics', () => ({ logAudioDiagnostic: jest.fn() }));

import { createWavRecorder } from '../WavRecorder';

const DEVICE_RATE = 44100;
const RENDER_QUANTUM = 128;
const SIGNAL = 0.5;
const WAV_HEADER_BYTES = 44;
const WAV_SAMPLE_RATE_OFFSET = 24;

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

function trackRate(stream: MediaStream): number {
  return stream.getAudioTracks()[0].getSettings().sampleRate ?? DEVICE_RATE;
}

class FakeSource {
  constructor(
    private context: FakeAudioContext,
    private stream: MediaStream
  ) {}
  connect(node: FakeAudioWorkletNode) {
    node.source = this;
  }
  disconnect() {
    /* fake graph */
  }
  /** Silence when the context resamples the mic (the macOS Chrome fault). */
  samples(count: number): Float32Array {
    const chunk = new Float32Array(count);
    if (this.context.sampleRate === trackRate(this.stream)) chunk.fill(SIGNAL);
    return chunk;
  }
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  sampleRate: number;
  state = 'running';
  destination = {};
  audioWorklet = { addModule: async () => undefined };
  constructor(options?: { sampleRate?: number }) {
    this.sampleRate = options?.sampleRate ?? DEVICE_RATE;
    FakeAudioContext.instances.push(this);
  }
  createMediaStreamSource(stream: MediaStream) {
    return new FakeSource(this, stream);
  }
  createGain() {
    const noop = () => undefined;
    return { gain: { value: 1 }, connect: noop, disconnect: noop };
  }
  createBuffer(channels: number, length: number, rate: number) {
    return new FakeAudioBuffer(channels, length, rate);
  }
  async resume() {
    /* always running */
  }
  async close() {
    this.state = 'closed';
  }
}

/** Nearest-sample resampler standing in for OfflineAudioContext rendering. */
class FakeOfflineAudioContext {
  destination = {};
  private input: FakeAudioBuffer | undefined;
  constructor(
    private channels: number,
    private length: number,
    public sampleRate: number
  ) {}
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
      const from = src.getChannelData(ch);
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

class FakeAudioWorkletNode {
  static instances: FakeAudioWorkletNode[] = [];
  source: FakeSource | undefined;
  private recording = false;
  private data: Float32Array[] = [];
  port = {
    onmessage: undefined as
      ((e: { data: { type: string; data: unknown } }) => void) | undefined,
    postMessage: (msg: { type: string }) => {
      if (msg.type === 'startRecording') {
        this.recording = true;
        this.data = [];
      } else if (msg.type === 'stopRecording') {
        this.recording = false;
        const data = this.data;
        queueMicrotask(() =>
          this.port.onmessage?.({ data: { type: 'recordingComplete', data } })
        );
      }
    },
  };
  constructor() {
    FakeAudioWorkletNode.instances.push(this);
  }
  connect() {
    /* fake graph */
  }
  disconnect() {
    /* fake graph */
  }
  /** Run the worklet's process() for `quanta` render quanta. */
  render(quanta: number) {
    for (let i = 0; i < quanta; i++) {
      if (!this.recording || !this.source) return;
      const chunk = this.source.samples(RENDER_QUANTUM);
      this.data.push(chunk);
      this.port.onmessage?.({ data: { type: 'audioData', data: chunk } });
    }
  }
}

function fakeStream(sampleRate?: number): MediaStream {
  const track = {
    getSettings: () => (sampleRate === undefined ? {} : { sampleRate }),
  };
  return { getAudioTracks: () => [track] } as unknown as MediaStream;
}

async function recordTake(stream: MediaStream, quanta = 100) {
  const recorder = createWavRecorder(stream, jest.fn());
  await recorder.initializeWorklet();
  await recorder.start();
  const nodes = FakeAudioWorkletNode.instances;
  nodes[nodes.length - 1].render(quanta);
  const blob = await recorder.stop();
  recorder.cleanup();
  const view = new DataView(await blob.arrayBuffer());
  const samples = new Float32Array(
    view.buffer.slice(WAV_HEADER_BYTES) as ArrayBuffer
  );
  return {
    sampleRate: view.getUint32(WAV_SAMPLE_RATE_OFFSET, true),
    samples,
    peak: samples.reduce((max, s) => Math.max(max, Math.abs(s)), 0),
  };
}

describe('createWavRecorder capture sample rate (TT-7805)', () => {
  const g = globalThis as unknown as Record<string, unknown>;
  const saved = {
    AudioContext: g.AudioContext,
    AudioWorkletNode: g.AudioWorkletNode,
    OfflineAudioContext: g.OfflineAudioContext,
  };
  // jsdom lacks blob URLs; WavRecorder loads its inline worklet through one.
  const savedUrl = {
    createObjectURL: URL.createObjectURL,
    revokeObjectURL: URL.revokeObjectURL,
  };

  beforeEach(() => {
    FakeAudioContext.instances = [];
    FakeAudioWorkletNode.instances = [];
    g.AudioContext = FakeAudioContext;
    g.AudioWorkletNode = FakeAudioWorkletNode;
    URL.createObjectURL = jest.fn(() => 'blob:worklet');
    URL.revokeObjectURL = jest.fn();
    g.OfflineAudioContext = jest.fn(
      (channels: number, length: number, rate: number) =>
        new FakeOfflineAudioContext(channels, length, rate)
    );
  });

  afterEach(() => {
    Object.assign(g, saved);
    Object.assign(URL, savedUrl);
  });

  it('keeps recorded audio when the mic runs at 44.1 kHz', async () => {
    const { peak } = await recordTake(fakeStream(44100));
    expect(peak).toBeGreaterThan(0.1);
  });

  it('keeps recorded audio when the track does not report a sample rate', async () => {
    const { peak } = await recordTake(fakeStream(undefined));
    expect(peak).toBeGreaterThan(0.1);
  });

  it('saves a 44.1 kHz take as 48 kHz WAV, like Windows', async () => {
    const quanta = 100;
    const { sampleRate, samples } = await recordTake(fakeStream(44100), quanta);
    expect(sampleRate).toBe(48000);
    expect(samples.length).toBe(
      Math.ceil((quanta * RENDER_QUANTUM * 48000) / 44100)
    );
  });

  it('records a 48 kHz mic at 48 kHz without resampling', async () => {
    const quanta = 100;
    const { sampleRate, samples, peak } = await recordTake(
      fakeStream(48000),
      quanta
    );
    expect(sampleRate).toBe(48000);
    expect(samples.length).toBe(quanta * RENDER_QUANTUM);
    expect(peak).toBeGreaterThan(0.1);
    expect(g.OfflineAudioContext).not.toHaveBeenCalled();
  });
});
