// TT-7805: a 4-channel interface on macOS Chrome delivers every input to the
// worklet. The voice was on a later channel, so keeping channel 1 saved silence.
// These run the real worklet source against a fake AudioWorkletProcessor.

jest.mock('../audioDiagnostics', () => ({
  getAudioTrackDiagnostics: jest.fn(),
  logAudioDiagnostic: jest.fn(),
}));

import { RECORDER_WORKLET_SOURCE } from '../WavRecorder';

const RENDER_QUANTUM = 128;

interface WorkletMessage {
  type: string;
  data?: unknown;
}

interface RecorderProcessor {
  port: {
    onmessage: (event: { data: WorkletMessage }) => void;
    postMessage: jest.Mock;
  };
  process: (inputs: Float32Array[][]) => boolean;
}

class FakeAudioWorkletProcessor {
  port = {
    onmessage: (() => undefined) as (event: { data: WorkletMessage }) => void,
    postMessage: jest.fn(),
  };
}

function loadProcessor(): RecorderProcessor {
  let Processor: (new () => RecorderProcessor) | undefined;
  const registerProcessor = (
    _name: string,
    ctor: new () => RecorderProcessor
  ) => {
    Processor = ctor;
  };
  new Function(
    'AudioWorkletProcessor',
    'registerProcessor',
    'console',
    RECORDER_WORKLET_SOURCE
  )(FakeAudioWorkletProcessor, registerProcessor, { log: () => undefined });
  return new Processor!();
}

/** One render quantum with `level` on the given channels and silence elsewhere. */
function quantum(channels: number, levels: Record<number, number>) {
  return [
    Array.from({ length: channels }, (_, ch) =>
      new Float32Array(RENDER_QUANTUM).fill(levels[ch] ?? 0)
    ),
  ];
}

function record(
  processor: RecorderProcessor,
  blocks: Float32Array[][][]
): Float32Array[] {
  processor.port.onmessage({ data: { type: 'startRecording' } });
  blocks.forEach((inputs) => processor.process(inputs));
  processor.port.onmessage({ data: { type: 'stopRecording' } });
  const complete = processor.port.postMessage.mock.calls
    .map(([msg]) => msg as WorkletMessage)
    .filter((msg) => msg.type === 'recordingComplete')
    .pop();
  return complete!.data as Float32Array[];
}

const peak = (chunks: Float32Array[]) =>
  chunks.reduce(
    (max, chunk) => chunk.reduce((m, s) => Math.max(m, Math.abs(s)), max),
    0
  );

describe('recorder worklet input channel (TT-7805)', () => {
  it('keeps the voice when it is on channel 3 of a 4-channel mic', () => {
    const chunks = record(
      loadProcessor(),
      Array.from({ length: 10 }, () => quantum(4, { 2: 0.5 }))
    );
    expect(chunks).toHaveLength(10);
    expect(peak(chunks)).toBe(0.5);
  });

  it('records a mono mic unchanged', () => {
    const chunks = record(loadProcessor(), [
      quantum(1, { 0: 0.25 }),
      quantum(1, { 0: 0.5 }),
    ]);
    expect(Array.from(chunks[0].slice(0, 2))).toEqual([0.25, 0.25]);
    expect(Array.from(chunks[1].slice(0, 2))).toEqual([0.5, 0.5]);
  });

  it('stays on the voice channel through a brief louder burst elsewhere', () => {
    const voice = Array.from({ length: 20 }, () => quantum(4, { 1: 0.3 }));
    const burst = quantum(4, { 1: 0.3, 3: 0.9 });
    const chunks = record(loadProcessor(), [...voice, burst, ...voice]);
    // Channel 1 carries 0.3 throughout; channel 3's 0.9 must not be saved.
    expect(peak(chunks)).toBeCloseTo(0.3);
  });

  it('chooses again for each take', () => {
    const processor = loadProcessor();
    record(
      processor,
      Array.from({ length: 10 }, () => quantum(4, { 0: 0.5 }))
    );
    processor.port.postMessage.mockClear();
    const chunks = record(
      processor,
      Array.from({ length: 10 }, () => quantum(4, { 3: 0.4 }))
    );
    expect(peak(chunks)).toBeCloseTo(0.4);
  });

  it('reports the chosen channel so diagnostics show it', () => {
    const processor = loadProcessor();
    record(processor, [quantum(4, { 2: 0.5 })]);
    expect(processor.port.postMessage).toHaveBeenCalledWith({
      type: 'channelSelected',
      data: { channel: 2, channels: 4 },
    });
  });
});
