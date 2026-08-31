/**
 * Browser-level recording mocks for Cypress CT (TT-7276 / TT-7384).
 * Uses window globals only — no ESM module stubs.
 */

export const RECORD_PREVIEW_TIMESLICE_MS = 1000;

export interface RecordingMockHelpers {
  getInstances: () => MockMediaRecorder[];
  getLastInstance: () => MockMediaRecorder | undefined;
  audioContext?: AudioContext;
  /** Fire `ended` on capture tracks so `listenForCaptureDeviceLoss` runs. */
  unplugCapture: () => void;
}

declare global {
  interface Window {
    __recordingMock?: RecordingMockHelpers;
    AudioWorklet?: typeof AudioWorklet;
  }
}

/** Build a mono PCM WAV blob decodable by AudioContext.decodeAudioData. */
export function createMinimalWavBlob(
  durationSec: number,
  sampleRate = 48000
): Blob {
  const numSamples = Math.max(1, Math.floor(durationSec * sampleRate));
  const dataSize = numSamples * 2; // 16-bit mono
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * 440 * t) * 0.01;
    const intSample = Math.max(
      -32768,
      Math.min(32767, Math.floor(sample * 32767))
    );
    view.setInt16(44 + i * 2, intSample, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * MediaRecorder stand-in for CT when cy.clock() must drive preview ticks.
 * Each tick emits a one-second WAV fragment; createAudioMediaRecorder accumulates
 * chunks into one Blob (like container-format MediaRecorder). Concatenated WAVs are
 * not independently decodable — reproduces TT-7384 / TT-7276 stop/save failures until
 * the production pipeline merges chunk decodes into a full take on stop.
 */
class MockMediaRecorder {
  static instances: MockMediaRecorder[] = [];

  stream: MediaStream;
  state: RecordingState = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((ev: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private timeSlice = RECORD_PREVIEW_TIMESLICE_MS;
  private tickCount = 0;
  private recordingStartedAt = 0;

  get emittedChunkCount(): number {
    return this.tickCount;
  }

  constructor(stream: MediaStream) {
    this.stream = stream;
    MockMediaRecorder.instances.push(this);
  }

  start(timeslice?: number): void {
    if (this.state === 'recording') return;
    this.state = 'recording';
    this.tickCount = 0;
    this.recordingStartedAt = Date.now();
    this.timeSlice =
      timeslice && timeslice > 0 ? timeslice : RECORD_PREVIEW_TIMESLICE_MS;

    this.intervalId = setInterval(() => {
      this.emitDuePreviewChunks();
    }, this.timeSlice);
  }

  /** Emit one chunk per elapsed timeslice (cy.clock advances Date). */
  private emitDuePreviewChunks(): void {
    const elapsedSlices = Math.floor(
      (Date.now() - this.recordingStartedAt) / this.timeSlice
    );
    while (this.tickCount < elapsedSlices) {
      this.emitPreviewChunk();
    }
  }

  requestData(): void {
    this.emitDuePreviewChunks();
  }

  private emitPreviewChunk(): void {
    if (this.state !== 'recording' || !this.ondataavailable) return;
    this.tickCount += 1;
    const blob = createMinimalWavBlob(1);
    this.ondataavailable({ data: blob } as BlobEvent);
  }

  stop(): void {
    if (this.state === 'inactive') return;
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    // Flush pending timeslices before leaving "recording" (emitPreviewChunk checks state).
    this.emitDuePreviewChunks();
    this.emitPreviewChunk();
    this.state = 'inactive';
    queueMicrotask(() => this.onstop?.());
  }
}

export interface InstallRecordingMocksOptions {
  /**
   * When true, delete AudioWorklet so useWavRecorder uses MediaRecorder fallback.
   * By default uses the browser's real MediaRecorder with an oscillator stream
   * (valid accumulated webm chunks, matching iOS / no-worklet production).
   * Set useMockMediaRecorder: true for cy.clock-friendly ticks with MockMediaRecorder.
   */
  forceMediaRecorderFallback?: boolean;
  /** When false with forceMediaRecorderFallback, keep native MediaRecorder. Default: false. */
  useMockMediaRecorder?: boolean;
}

async function createOscillatorStream(
  win: Window & typeof globalThis
): Promise<{ stream: MediaStream; audioContext: AudioContext }> {
  const audioContext = new win.AudioContext({ sampleRate: 48000 });
  if (audioContext.state === 'suspended') {
    await audioContext.resume();
  }
  const oscillator = audioContext.createOscillator();
  oscillator.frequency.value = 440;
  const gain = audioContext.createGain();
  gain.gain.value = 0.1;
  oscillator.connect(gain);
  const dest = audioContext.createMediaStreamDestination();
  gain.connect(dest);
  oscillator.start();
  return { stream: dest.stream, audioContext };
}

/**
 * Patches browser APIs on `win` before cy.mount.
 * Default: real oscillator MediaStream + WavRecorder (AudioWorklet) for decodable preview ticks.
 * Optional fallback: MockMediaRecorder with setInterval (cy.clock-friendly).
 */
export async function installRecordingMocks(
  win: Window & typeof globalThis,
  options: InstallRecordingMocksOptions = {}
): Promise<RecordingMockHelpers> {
  const { forceMediaRecorderFallback = false, useMockMediaRecorder = false } =
    options;

  MockMediaRecorder.instances = [];

  const { stream, audioContext } = await createOscillatorStream(win);

  win.navigator.mediaDevices.getUserMedia = async () => stream;

  if (!win.navigator.mediaDevices.getSupportedConstraints) {
    win.navigator.mediaDevices.getSupportedConstraints = () =>
      ({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      }) as MediaTrackSupportedConstraints;
  }

  if (forceMediaRecorderFallback) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (win as any).AudioWorklet = undefined;
    if (useMockMediaRecorder) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (win as any).MediaRecorder = MockMediaRecorder;
    }
  }

  const helpers: RecordingMockHelpers = {
    getInstances: () => MockMediaRecorder.instances,
    getLastInstance: () =>
      MockMediaRecorder.instances[MockMediaRecorder.instances.length - 1],
    audioContext,
    unplugCapture: () => {
      stream.getAudioTracks().forEach((track) => {
        track.dispatchEvent(new Event('ended'));
        try {
          track.stop();
        } catch {
          /* already gone */
        }
      });
    },
  };

  win.__recordingMock = helpers;
  return helpers;
}
