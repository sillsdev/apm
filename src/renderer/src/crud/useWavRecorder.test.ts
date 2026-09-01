import { act, renderHook } from '@testing-library/react';
import { CAPTURE_DEVICE_LOSS_RETRY_MS } from './captureConstraints';

const mockGetMediaStream = jest.fn();
const mockInitializeWorklet = jest.fn();
const mockStart = jest.fn();
const mockStop = jest.fn();
const mockCleanup = jest.fn();
const mockCreateAudioMediaRecorder = jest.fn();

jest.mock('./useUserMedia', () => ({
  useUserMedia: () => mockGetMediaStream,
  CaptureAcquireSupersededError: class CaptureAcquireSupersededError extends Error {
    constructor() {
      super('capture acquire superseded');
      this.name = 'CaptureAcquireSupersededError';
    }
  },
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [undefined, jest.fn()],
}));

jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('../utils', () => ({
  logError: jest.fn(),
  Severity: { error: 'error' },
}));

jest.mock('./AudioMediaRecorder', () => ({
  createAudioMediaRecorder: (...args: unknown[]) =>
    mockCreateAudioMediaRecorder(...args),
}));

jest.mock('./WavRecorder', () => ({
  createWavRecorder: (...args: unknown[]) =>
    mockCreateAudioMediaRecorder(...args),
}));

jest.mock('./recordPeaksCapture', () => ({
  createRecordPeaksCapture: jest.fn(),
}));

jest.mock('./audioDiagnostics', () => ({
  getAudioTrackDiagnostics: () => [],
  getBlobDiagnostics: () => ({}),
  logAudioDiagnostic: jest.fn(),
}));

import { useWavRecorder } from './useWavRecorder';

function fakeStream(id: string, muted = false) {
  const track = {
    stop: jest.fn(),
    readyState: 'live' as const,
    muted,
    getSettings: () => ({ deviceId: id }),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  };
  return {
    id,
    active: true,
    getTracks: () => [track],
    getAudioTracks: () => [track],
    track,
  } as unknown as MediaStream & { track: typeof track };
}

function recorderMock() {
  return {
    initializeWorklet: mockInitializeWorklet,
    start: mockStart,
    stop: mockStop,
    cleanup: mockCleanup,
  };
}

describe('useWavRecorder capture races', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInitializeWorklet.mockResolvedValue(undefined);
    mockStart.mockResolvedValue(undefined);
    mockStop.mockResolvedValue(new Blob(['take']));
    mockCreateAudioMediaRecorder.mockImplementation(() => recorderMock());
    Object.defineProperty(global, 'AudioWorklet', {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    });
  });

  function renderRecorder(
    deviceId = 'mic-a',
    {
      onStop = jest.fn(),
      onError = jest.fn(),
    }: { onStop?: jest.Mock; onError?: jest.Mock } = {}
  ) {
    return {
      ...renderHook(
        ({ id }: { id: string }) =>
          useWavRecorder(
            true,
            jest.fn(),
            onStop,
            onError,
            async () => undefined,
            id
          ),
        { initialProps: { id: deviceId } }
      ),
      onStop,
      onError,
    };
  }

  async function flushEnsureStream() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it('replaces a cached stream that stays muted when a take starts', async () => {
    const cached = fakeStream('cached');
    const replacement = fakeStream('fresh');
    mockGetMediaStream
      .mockResolvedValueOnce({ stream: cached, fellBack: false })
      .mockResolvedValue({ stream: replacement, fellBack: false });

    const { result } = renderRecorder();
    await flushEnsureStream();

    await act(async () => {
      await result.current.startRecording();
    });
    act(() => {
      result.current.stopRecording();
    });
    await act(async () => {
      await Promise.resolve();
    });

    cached.track.muted = true;
    mockCreateAudioMediaRecorder.mockClear();

    jest.useFakeTimers();
    let started: Promise<boolean> | undefined;
    try {
      act(() => {
        started = result.current.startRecording();
      });
      await act(async () => {
        jest.advanceTimersByTime(CAPTURE_DEVICE_LOSS_RETRY_MS);
        await started;
      });
    } finally {
      jest.useRealTimers();
    }

    expect(mockGetMediaStream).toHaveBeenLastCalledWith(true);
    expect(mockCreateAudioMediaRecorder).toHaveBeenCalledWith(
      replacement,
      expect.any(Function)
    );
  });

  it('discards a recorder whose initializeWorklet finishes after a device change', async () => {
    const first = fakeStream('mic-a');
    const second = fakeStream('mic-b');
    mockGetMediaStream
      .mockResolvedValueOnce({ stream: first, fellBack: false })
      .mockResolvedValue({ stream: second, fellBack: false });

    let resolveInit: () => void = () => undefined;
    mockInitializeWorklet.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveInit = resolve;
      })
    );

    const { result, rerender } = renderRecorder('mic-a');
    await flushEnsureStream();

    let started: Promise<boolean> | undefined;
    act(() => {
      started = result.current.startRecording();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockInitializeWorklet).toHaveBeenCalled();

    rerender({ id: 'mic-b' });
    await flushEnsureStream();

    await act(async () => {
      resolveInit();
      await started;
    });

    expect(mockCleanup).toHaveBeenCalled();
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('stops a recorder that started after a device change without publishing', async () => {
    const first = fakeStream('mic-a');
    const second = fakeStream('mic-b');
    mockGetMediaStream
      .mockResolvedValueOnce({ stream: first, fellBack: false })
      .mockResolvedValue({ stream: second, fellBack: false });

    let resolveStart: () => void = () => undefined;
    mockStart.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveStart = resolve;
      })
    );

    const { result, rerender, onStop } = renderRecorder('mic-a');
    await flushEnsureStream();

    let started: Promise<boolean> | undefined;
    act(() => {
      started = result.current.startRecording();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(mockStart).toHaveBeenCalled();

    rerender({ id: 'mic-b' });
    await flushEnsureStream();

    await act(async () => {
      resolveStart();
      await started;
    });

    expect(await started).toBe(false);
    expect(mockStop).toHaveBeenCalled();
    expect(mockCleanup).toHaveBeenCalled();
    expect(onStop).not.toHaveBeenCalled();
  });

  it('joins an in-flight stop when the capture track ends', async () => {
    const stream = fakeStream('mic-a');
    mockGetMediaStream.mockResolvedValue({ stream, fellBack: false });

    let resolveStop: (blob: Blob) => void = () => undefined;
    mockStop.mockReturnValue(
      new Promise<Blob>((resolve) => {
        resolveStop = resolve;
      })
    );

    const { result, onStop, onError } = renderRecorder('mic-a');
    await flushEnsureStream();

    await act(async () => {
      await result.current.startRecording();
    });

    act(() => {
      result.current.stopRecording();
    });
    expect(mockStop).toHaveBeenCalledTimes(1);

    const ended = stream.track.addEventListener.mock.calls.find(
      (call) => call[0] === 'ended'
    )?.[1] as (() => void) | undefined;
    expect(ended).toBeDefined();
    act(() => {
      ended?.();
    });
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ deviceLost: true })
    );

    const blob = new Blob(['take']);
    await act(async () => {
      resolveStop(blob);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onStop).toHaveBeenCalledWith(blob);
  });
});
