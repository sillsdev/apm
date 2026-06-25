import { createAudioMediaRecorder } from '../AudioMediaRecorder';

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  state: RecordingState = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((ev: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(public stream: MediaStream) {
    MockMediaRecorder.instances.push(this);
  }

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    if (this.state === 'inactive') return;
    this.state = 'inactive';
    queueMicrotask(() => this.onstop?.());
  }

  requestData(): void {
    // no-op for tests
  }

  /** Test helper: simulate browser firing one chunk */
  simulateChunk(data: Blob): void {
    this.ondataavailable?.({ data } as BlobEvent);
  }
}

async function waitForMockCalls(
  mockFn: jest.Mock,
  minCalls: number,
  timeoutMs = 1000
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (mockFn.mock.calls.length < minCalls) {
    if (Date.now() >= deadline) break;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  expect(mockFn.mock.calls.length).toBeGreaterThanOrEqual(minCalls);
}

const mockDecodeAudioData = jest.fn(
  (arrayBuffer: ArrayBuffer, success: (buffer: AudioBuffer) => void) => {
    const byteLength = arrayBuffer.byteLength || 48000;
    const length = Math.max(1, Math.floor(byteLength / 2));
    const mockBuffer = {
      length,
      sampleRate: 48000,
      numberOfChannels: 1,
      getChannelData: () => new Float32Array(length),
    } as unknown as AudioBuffer;
    success(mockBuffer);
  }
);

describe('createAudioMediaRecorder', () => {
  beforeEach(() => {
    MockMediaRecorder.instances = [];
    mockDecodeAudioData.mockClear();
    global.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;
    global.AudioContext = jest.fn().mockImplementation(() => ({
      state: 'running',
      resume: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      decodeAudioData: mockDecodeAudioData,
    })) as unknown as typeof AudioContext;
  });

  it('emits decodable WAV previews and stop blob from accumulated chunks', async () => {
    const onDataAvailable = jest.fn();
    const stream = {} as MediaStream;
    const rec = createAudioMediaRecorder(stream, onDataAvailable);

    await rec.start(1000);
    const inst = MockMediaRecorder.instances[0];
    const a = new Blob(['a'], { type: 'audio/webm' });
    const b = new Blob(['bb'], { type: 'audio/webm' });
    inst.simulateChunk(a);
    inst.simulateChunk(b);

    // Second chunk sets previewNeedsRetry; retry runs in first emit's finally block.
    await waitForMockCalls(onDataAvailable, 2);

    expect(onDataAvailable.mock.calls[0][0].type).toContain('audio/wav');
    expect(onDataAvailable.mock.calls[1][0].type).toContain('audio/wav');

    const finalBlob = await rec.stop();
    expect(finalBlob.type).toContain('audio/wav');
    expect(finalBlob.size).toBeGreaterThan(0);
  });
});
