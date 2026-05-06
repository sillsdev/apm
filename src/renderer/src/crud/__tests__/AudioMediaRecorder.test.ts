import { createAudioMediaRecorder } from '../AudioMediaRecorder';

class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];
  state: RecordingState = 'inactive';
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

describe('createAudioMediaRecorder', () => {
  beforeEach(() => {
    MockMediaRecorder.instances = [];
    global.MediaRecorder = MockMediaRecorder as unknown as typeof MediaRecorder;
    global.AudioContext = jest.fn().mockImplementation(() => ({
      state: 'running',
      resume: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    })) as unknown as typeof AudioContext;
  });

  it('passes accumulated blob to onDataAvailable each tick, stop() returns merged blob', async () => {
    const onDataAvailable = jest.fn();
    const stream = {} as MediaStream;
    const rec = createAudioMediaRecorder(stream, onDataAvailable);

    await rec.start(1000);
    const inst = MockMediaRecorder.instances[0];
    const a = new Blob(['a'], { type: 'audio/webm' });
    const b = new Blob(['bb'], { type: 'audio/webm' });
    inst.simulateChunk(a);
    inst.simulateChunk(b);

    // Preview must emit an accumulated (decodable) blob each tick because
    // individual container-format chunks are not independently decodable.
    expect(onDataAvailable).toHaveBeenCalledTimes(2);
    expect(onDataAvailable.mock.calls[0][0].size).toBe(a.size);
    expect(onDataAvailable.mock.calls[1][0].size).toBe(a.size + b.size);

    const finalBlob = await rec.stop();
    expect(finalBlob.size).toBe(a.size + b.size);
  });
});
