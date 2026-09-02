/**
 * Browser-level recording mocks for Cypress CT (TT-7276 / TT-7384).
 * Uses window globals only — no ESM module stubs.
 */

export const RECORD_PREVIEW_TIMESLICE_MS = 1000;

/** enumerateDevices / getSettings id so `{ exact: deviceId }` acquire succeeds. */
export const MOCK_CAPTURE_DEVICE_ID = 'apm-ct-mic';

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

/**
 * cy.clock() freezes timers; AudioContext.resume() on a later context in the
 * same document often never settles. Resolve immediately so start/stop are not
 * stuck waiting. Native resume still runs for the real hardware path.
 */
function patchAudioContextResume(win: Window & typeof globalThis): void {
  // Window ∩ globalThis types AudioContext as the instance, not the ctor.
  const proto = (
    win.AudioContext as unknown as {
      prototype: AudioContext & { __apmResumePatched?: boolean };
    }
  )?.prototype;
  if (!proto || proto.__apmResumePatched) return;
  const native = proto.resume;
  proto.resume = function (this: AudioContext) {
    try {
      void native.call(this);
    } catch {
      /* closed / invalid state */
    }
    return Promise.resolve();
  };
  proto.__apmResumePatched = true;
}

function requestedExactDeviceId(
  constraints?: MediaStreamConstraints
): string | undefined {
  const audio = constraints?.audio;
  if (!audio || typeof audio === 'boolean') return undefined;
  const id = audio.deviceId;
  if (typeof id === 'string') return id || undefined;
  if (id && typeof id === 'object' && 'exact' in id) {
    const exact = (id as ConstrainDOMStringParameters).exact;
    return typeof exact === 'string' && exact ? exact : undefined;
  }
  return undefined;
}

function mockAudioInputDevice(): MediaDeviceInfo {
  return {
    deviceId: MOCK_CAPTURE_DEVICE_ID,
    groupId: 'apm-ct-group',
    kind: 'audioinput',
    label: 'Mock microphone',
    toJSON() {
      return {
        deviceId: this.deviceId,
        groupId: this.groupId,
        kind: this.kind,
        label: this.label,
      };
    },
  } as MediaDeviceInfo;
}

function presentCaptureTrack(
  track: MediaStreamTrack,
  deviceId: () => string
): MediaStreamTrack {
  const view = Object.create(track) as MediaStreamTrack;
  Object.defineProperty(view, 'muted', {
    configurable: true,
    get: () => false,
  });
  Object.defineProperty(view, 'readyState', {
    configurable: true,
    get: () =>
      track.readyState === 'ended'
        ? 'ended'
        : ('live' as MediaStreamTrackState),
  });
  view.getSettings = () => ({ ...track.getSettings(), deviceId: deviceId() });
  view.stop = () => track.stop();
  view.addEventListener = track.addEventListener.bind(track);
  view.removeEventListener = track.removeEventListener.bind(track);
  view.dispatchEvent = track.dispatchEvent.bind(track);
  return view;
}

function captureStreamHasLiveAudio(stream: MediaStream): boolean {
  try {
    return (
      stream.active &&
      stream.getAudioTracks().some((t) => t.readyState === 'live')
    );
  } catch {
    return false;
  }
}

function decorateCaptureStream(
  stream: MediaStream,
  deviceId: () => string
): MediaStream {
  const nativeGetAudioTracks = stream.getAudioTracks.bind(stream);
  const nativeGetTracks = stream.getTracks.bind(stream);
  const views = new WeakMap<MediaStreamTrack, MediaStreamTrack>();
  const viewOf = (track: MediaStreamTrack) => {
    let view = views.get(track);
    if (!view) {
      view = presentCaptureTrack(track, deviceId);
      views.set(track, view);
    }
    return view;
  };
  const getAudioTracks = () => nativeGetAudioTracks().map(viewOf);
  const getTracks = () => nativeGetTracks().map(viewOf);
  try {
    Object.defineProperty(stream, 'active', {
      configurable: true,
      get: () => true,
    });
    Object.defineProperty(stream, 'getAudioTracks', {
      configurable: true,
      writable: true,
      value: getAudioTracks,
    });
    Object.defineProperty(stream, 'getTracks', {
      configurable: true,
      writable: true,
      value: getTracks,
    });
  } catch {
    stream.getAudioTracks = getAudioTracks;
    stream.getTracks = getTracks;
  }
  return stream;
}

async function createOscillatorStream(
  win: Window & typeof globalThis
): Promise<{ stream: MediaStream; audioContext: AudioContext }> {
  patchAudioContextResume(win);
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

  patchAudioContextResume(win);
  const { stream: oscillatorStream, audioContext } =
    await createOscillatorStream(win);

  // Stale saved mics are `{ exact }` now; they must appear in enumerateDevices
  // and on the track or acquire falls back and Record never reaches Pause/Stop.
  Object.keys(win.localStorage)
    .filter((key) => key.endsWith('microphone-id'))
    .forEach((key) => win.localStorage.removeItem(key));

  let reportedDeviceId = MOCK_CAPTURE_DEVICE_ID;
  const deviceId = () => reportedDeviceId;
  const capture = {
    stream: decorateCaptureStream(oscillatorStream, deviceId),
  };

  const nativeGetUserMedia = win.navigator.mediaDevices.getUserMedia.bind(
    win.navigator.mediaDevices
  );

  win.navigator.mediaDevices.enumerateDevices = async () => [
    mockAudioInputDevice(),
  ];
  win.navigator.mediaDevices.getUserMedia = async (constraints) => {
    reportedDeviceId =
      requestedExactDeviceId(constraints) ?? MOCK_CAPTURE_DEVICE_ID;
    try {
      // Ignore `{ exact }` — Chrome's fake device id is not apm-ct-mic.
      // Stamp the requested id on getSettings so TT-6917's check passes.
      const native = await nativeGetUserMedia({ audio: true, video: false });
      if (captureStreamHasLiveAudio(native)) {
        capture.stream = decorateCaptureStream(native, deviceId);
      }
    } catch {
      /* oscillator fallback already on capture.stream */
    }
    return capture.stream;
  };

  if (!win.navigator.mediaDevices.getSupportedConstraints) {
    win.navigator.mediaDevices.getSupportedConstraints = () =>
      ({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        deviceId: true,
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
      capture.stream.getAudioTracks().forEach((track) => {
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
