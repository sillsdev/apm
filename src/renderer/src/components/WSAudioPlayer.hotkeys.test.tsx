import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';

const RECORD_KEY = 'F9,CTRL+9';

let capturedOnWSReady:
  | ((duration: number, loadingAnother: boolean) => void)
  | undefined;

const waveSurferMock = {
  wsLoad: jest.fn(),
  wsClear: jest.fn(),
  wsTogglePlay: jest.fn(() => false),
  wsPlayRegion: jest.fn(),
  wsBlob: jest.fn(async () => undefined),
  wsRegionBlob: jest.fn(),
  wsPause: jest.fn(),
  wsDuration: jest.fn(() => 0),
  wsPosition: jest.fn(() => 0),
  wsSetPlaybackRate: jest.fn(),
  wsSkip: jest.fn(),
  wsGoto: jest.fn(),
  wsLoadRegions: jest.fn(),
  wsClearRegions: jest.fn(),
  wsGetRegions: jest.fn(() => '{}'),
  wsLoopRegion: jest.fn(() => false),
  wsRegionDelete: jest.fn(async () => undefined),
  wsRegionReplace: jest.fn(),
  wsUndo: jest.fn(),
  wsInsertAudio: jest.fn(async () => 0),
  wsFillPx: jest.fn(() => 100),
  wsZoom: jest.fn(),
  wsAutoSegment: jest.fn(),
  wsPrevRegion: jest.fn(() => true),
  wsNextRegion: jest.fn(() => true),
  wsRemoveSplitRegion: jest.fn(() => true),
  wsAddRegion: jest.fn(() => true),
  wsSetHeight: jest.fn(),
  wsStartRecord: jest.fn(),
  wsStopRecord: jest.fn(),
  wsRecordingPeaks: jest.fn(async () => undefined),
  wsAddMarkers: jest.fn(),
  applyRegionColors: jest.fn(),
};

// Context must be created inside the factory (jest hoists mocks; use requireActual
// for React so Provider/useContext share one instance — see jest-testing-takeaways).
jest.mock('../context/HotKeyContext', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const subscribe = jest.fn();
  const unsubscribe = jest.fn();
  return {
    HotKeyContext: React.createContext({
      state: {
        subscribe,
        unsubscribe,
        localizeHotKey: (key: string) => key,
      },
      setState: jest.fn(),
    }),
    hotkeyTestMocks: { subscribe, unsubscribe },
  };
});

import WSAudioPlayer from './WSAudioPlayer';

const { subscribe: mockSubscribe, unsubscribe: mockUnsubscribe } = (
  jest.requireMock('../context/HotKeyContext') as {
    hotkeyTestMocks: {
      subscribe: jest.Mock;
      unsubscribe: jest.Mock;
    };
  }
).hotkeyTestMocks;

jest.mock('../crud/useWaveSurfer', () => ({
  useWaveSurfer: (
    _allowSegment: unknown,
    _container: unknown,
    onReady: (duration: number, loadingAnother: boolean) => void
  ) => {
    capturedOnWSReady = onReady;
    return waveSurferMock;
  },
}));

let capturedOnRecordError:
  | ((e: { deviceLost?: boolean; deviceId?: string }) => void)
  | undefined;
let capturedOnRecordStop: ((blob?: Blob) => void | Promise<void>) | undefined;
const mockStartRecording = jest.fn(() => Promise.resolve(true));

jest.mock('../crud/useWavRecorder', () => ({
  useWavRecorder: (
    _allowRecord: unknown,
    _onStart: unknown,
    onStop: (blob?: Blob) => void | Promise<void>,
    onError: (e: { deviceLost?: boolean; deviceId?: string }) => void
  ) => {
    capturedOnRecordStop = onStop;
    capturedOnRecordError = onError;
    return {
      startRecording: mockStartRecording,
      stopRecording: jest.fn(),
    };
  },
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({
    record: 'Record',
    stop: 'Stop',
    save: 'Save',
    clearRecording: 'Clear',
    aiInProgress: 'AI in progress',
    loading: 'Loading',
    playTip: 'Play {0}',
    pauseTip: 'Pause {0}',
    stopTip: 'Stop {0}',
    recordTip: 'Record {0}',
    clearRecordingTip: 'Clear',
    reduceNoise: 'Reduce noise',
    downloadMedia: 'Download',
    microphoneDisconnected:
      'The microphone was disconnected. Select another microphone to record.',
    microphoneDisconnectedFallback:
      'The preferred microphone was disconnected. Default microphone selected.',
    getString: (key: string) => key,
  }),
  shallowEqual: jest.fn(),
}));

jest.mock('../selector', () => ({
  wsAudioPlayerSelector: jest.fn(),
  audioDownloadSelector: jest.fn(),
  sharedSelector: jest.fn(),
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [undefined, jest.fn()],
}));

const mockShowMessage = jest.fn();

jest.mock('../hoc/SnackBar', () => ({
  AlertSeverity: {
    Error: 'error',
    Info: 'info',
    Success: 'success',
    Warning: 'warning',
  },
  useSnackBar: () => ({
    showMessage: mockShowMessage,
    showTitledMessage: jest.fn(),
    messageReset: jest.fn(),
  }),
}));

jest.mock('../crud/useOrgDefaults', () => ({
  useOrgDefaults: () => ({
    getOrgDefault: jest.fn(),
  }),
  orgDefaultFeatures: {},
  orgDefaultVoices: {},
}));

jest.mock('../utils/useAudioAi', () => ({
  useAudioAi: () => ({ requestAudioAi: jest.fn() }),
}));

jest.mock('../utils', () => ({
  dataPath: jest.fn(),
  PathType: { MEDIA: 'media' },
  Severity: { error: 'error' },
  useCheckOnline: () => jest.fn(),
  LocalKey: { microphoneId: 'microphoneId' },
  localUserKey: (key: string) => key,
  useMobile: () => ({ isMobile: false, isMobileWidth: false }),
  logError: jest.fn(),
}));

jest.mock('../control', () => ({
  Button: ({
    children,
    disabled,
    id,
    onClick,
  }: {
    children?: React.ReactNode;
    disabled?: boolean;
    id?: string;
    onClick?: () => void;
  }) => (
    <button type="button" id={id} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  smallButtonProps: {},
  Duration: () => null,
  GrowingSpacer: () => null,
  LightTooltip: ({ children }: { children?: React.ReactNode }) => (
    <>{children}</>
  ),
  RecordButton: () => null,
}));

jest.mock('../crud/useVoiceUrl', () => ({
  useVoiceUrl: () => '',
}));

jest.mock('./useAudioDownload', () => ({
  useAudioDownload: () => ({
    isDisabled: true,
    startDownload: jest.fn(),
  }),
}));

jest.mock('../../api-variable', () => ({
  isElectron: false,
}));

jest.mock('../hoc/BigDialog', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('../hoc/BigDialogBp', () => ({
  __esModule: true,
  default: ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

jest.mock('./WSAudioPlayerZoom', () => ({
  __esModule: true,
  default: () => null,
  maxZoom: 500,
}));

jest.mock('./WSAudioPlayerRate', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./WSAudioPlayerSegment', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./AlertDialog', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('./AudioDownload', () => ({
  AudioDownloadView: () => null,
}));

jest.mock('../business/voice/SelectVoice', () => ({
  __esModule: true,
  default: () => null,
}));

const defaultProps = {
  height: 100,
  segments: '{}',
  allowRecord: true,
  mediaId: 'existing-media-id',
};

describe('WSAudioPlayer record hotkeys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnWSReady = undefined;
  });

  afterEach(cleanup);

  it('re-subscribes F9 when loading finishes so the handler is not stale', () => {
    const { rerender } = render(
      <WSAudioPlayer {...defaultProps} loading={true} />
    );

    act(() => {
      capturedOnWSReady?.(10, false);
    });

    rerender(<WSAudioPlayer {...defaultProps} loading={false} />);

    const recordSubscribeCalls = mockSubscribe.mock.calls.filter(
      (call) => call[0] === RECORD_KEY
    );
    expect(recordSubscribeCalls.length).toBeGreaterThanOrEqual(2);

    const firstCb = recordSubscribeCalls[0][1] as () => boolean;
    const lastCb = recordSubscribeCalls[
      recordSubscribeCalls.length - 1
    ][1] as () => boolean;
    expect(firstCb).not.toBe(lastCb);

    expect(firstCb()).toBe(false);
    expect(lastCb()).toBe(true);
  });

  it('unsubscribes record hotkeys when allowRecord is false', () => {
    const { rerender } = render(<WSAudioPlayer {...defaultProps} />);

    rerender(
      <WSAudioPlayer {...defaultProps} allowRecord={false} loading={false} />
    );

    expect(mockUnsubscribe).toHaveBeenCalledWith(RECORD_KEY);
  });

  it('shows loading overlay when mediaId is set and loading', () => {
    const { getByText, container } = render(
      <WSAudioPlayer {...defaultProps} loading={true} />
    );

    expect(getByText('Loading')).toBeTruthy();
    expect(
      container.querySelector('#wsAudioWaveform')?.getAttribute('style')
    ).toMatch(/visibility:\s*hidden/);
  });

  it('keeps loading overlay until wavesurfer ready after blob arrives', () => {
    const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/wav' });
    const { getByText, queryByText, rerender } = render(
      <WSAudioPlayer {...defaultProps} loading={false} blob={blob} />
    );

    // loading cleared but ready still false until onWSReady
    expect(getByText('Loading')).toBeTruthy();

    act(() => {
      capturedOnWSReady?.(10, false);
    });
    rerender(<WSAudioPlayer {...defaultProps} loading={false} blob={blob} />);

    expect(queryByText('Loading')).toBeNull();
  });
});

describe('WSAudioPlayer microphone disconnect fallback', () => {
  const headset = {
    kind: 'audioinput' as const,
    deviceId: 'headset',
    label: 'Headset',
  };
  const laptop = {
    kind: 'audioinput' as const,
    deviceId: 'laptop',
    label: 'Laptop',
  };
  let enumerateDevices: jest.Mock;
  let onDeviceChange: (() => void) | undefined;
  let previousMediaDevices: MediaDevices | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnRecordError = undefined;
    onDeviceChange = undefined;
    localStorage.setItem('microphoneId', 'headset');
    enumerateDevices = jest
      .fn()
      .mockResolvedValueOnce([headset, laptop])
      .mockResolvedValue([laptop]);
    previousMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices,
        addEventListener: jest.fn((_type: string, cb: () => void) => {
          onDeviceChange = cb;
        }),
        removeEventListener: jest.fn(),
        getSupportedConstraints: () => ({}),
      },
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem('microphoneId');
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: previousMediaDevices,
    });
  });

  it('applies the refreshed fallback when the selected first device is unplugged before enumerateDevices updates', async () => {
    await act(async () => {
      render(<WSAudioPlayer {...defaultProps} />);
    });

    expect(localStorage.getItem('microphoneId')).toBe('headset');

    act(() => {
      capturedOnRecordError?.({ deviceLost: true });
    });

    expect(localStorage.getItem('microphoneId')).toBe('headset');
    expect(mockShowMessage).toHaveBeenCalledTimes(1);

    await act(async () => {
      onDeviceChange?.();
    });

    await waitFor(() =>
      expect(localStorage.getItem('microphoneId')).toBe('laptop')
    );
    expect(mockShowMessage).toHaveBeenCalledTimes(1);
  });
});

function latestRecordHandler() {
  const calls = mockSubscribe.mock.calls.filter(
    (call) => call[0] === RECORD_KEY
  );
  return calls[calls.length - 1]?.[1] as (() => boolean) | undefined;
}

function PlayerWithProcessingSave(
  props: React.ComponentProps<typeof WSAudioPlayer>
) {
  const [processing, setProcessing] = React.useState(false);
  return (
    <WSAudioPlayer
      {...props}
      onProcessingRecordingChange={setProcessing}
      handleSave={props.handleSave ?? jest.fn()}
      isSaveDisabled={processing}
    />
  );
}

describe('WSAudioPlayer microphone-loss stop processing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnRecordError = undefined;
    capturedOnRecordStop = undefined;
  });

  afterEach(cleanup);

  async function startTake() {
    await act(async () => {
      latestRecordHandler()?.();
      await Promise.resolve(mockStartRecording.mock.results.at(-1)?.value);
    });
    expect(mockStartRecording).toHaveBeenCalled();
  }

  it('keeps save and record blocked until the recovered blob finishes onRecordStop', async () => {
    const onRecording = jest.fn();
    render(
      <PlayerWithProcessingSave {...defaultProps} onRecording={onRecording} />
    );
    await startTake();
    await waitFor(() => expect(onRecording).toHaveBeenCalledWith(true));

    act(() => {
      capturedOnRecordError?.({ deviceLost: true });
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    );
    const startsAfterLoss = mockStartRecording.mock.calls.length;
    act(() => {
      latestRecordHandler()?.();
    });
    expect(mockStartRecording.mock.calls.length).toBe(startsAfterLoss);

    await act(async () => {
      await capturedOnRecordStop?.(new Blob(['take'], { type: 'audio/wav' }));
    });

    expect(waveSurferMock.wsInsertAudio).toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
    );
  });

  it('clears processing when device-loss finalization returns no blob', async () => {
    const onRecording = jest.fn();
    render(
      <PlayerWithProcessingSave {...defaultProps} onRecording={onRecording} />
    );
    await startTake();
    await waitFor(() => expect(onRecording).toHaveBeenCalledWith(true));

    act(() => {
      capturedOnRecordError?.({ deviceLost: true });
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    );

    await act(async () => {
      await capturedOnRecordStop?.(undefined);
    });

    expect(waveSurferMock.wsInsertAudio).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
    );
  });

  it('keeps save blocked when the mic is lost while stop is already finalizing', async () => {
    const onRecording = jest.fn();
    render(
      <PlayerWithProcessingSave {...defaultProps} onRecording={onRecording} />
    );
    await startTake();
    await waitFor(() => expect(onRecording).toHaveBeenCalledWith(true));

    act(() => {
      latestRecordHandler()?.();
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
    );

    act(() => {
      capturedOnRecordError?.({ deviceLost: true });
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await act(async () => {
      await capturedOnRecordStop?.(new Blob(['take'], { type: 'audio/wav' }));
    });

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled()
    );
  });
});
