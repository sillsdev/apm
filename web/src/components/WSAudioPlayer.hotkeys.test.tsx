import React from 'react';
import {
  jest,
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
} from '@jest/globals';
import '@testing-library/jest-dom/jest-globals';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

const RECORD_KEY = 'F9,CTRL+9';

let capturedOnWSReady:
  ((duration: number, loadingAnother: boolean) => void) | undefined;
let capturedOnWSRegion:
  ((count: number, newRegion: boolean) => void) | undefined;
let capturedOnPlayStatus: ((playing: boolean) => void) | undefined;
let capturedOnWSCanUndo: ((canUndo: boolean) => void) | undefined;
let capturedOnCurrentRegion:
  | ((
      region: { start: number; end: number } | undefined,
      index?: number
    ) => void)
  | undefined;
let capturedOnCanPaste: ((canPaste: boolean) => void) | undefined;

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
  wsRegionDelete: jest.fn(async () => true),
  wsRegionReplace: jest.fn(),
  wsCopyRegion: jest.fn(() => true),
  wsPaste: jest.fn(async () => true),
  wsHasClipboard: jest.fn(() => false),
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

type UseWaveSurfer = typeof import('../crud/useWaveSurfer').useWaveSurfer;
import WSAudioPlayer from './WSAudioPlayer';
import { AudioAiError, AudioAiErrorCode } from '../utils/audioAiError';

const { subscribe: mockSubscribe, unsubscribe: mockUnsubscribe } = (
  jest.requireMock('../context/HotKeyContext') as {
    hotkeyTestMocks: {
      subscribe: jest.Mock;
      unsubscribe: jest.Mock;
    };
  }
).hotkeyTestMocks;

const mockUseWaveSurfer: UseWaveSurfer = (
  _allowSegment,
  _container,
  onReady,
  _onLoadError,
  _onProgress,
  onRegion,
  onCanUndo,
  onPlayStatus,
  _onInteraction,
  _onZoom,
  _onMarkerClick,
  _height,
  _singleRegionOnly,
  _currentSegmentIndex,
  onCurrentRegion,
  _onStartRegion,
  _onRegionPlayEnd,
  _verses,
  _hasSegmentUndo,
  _applyRegionColor,
  _lockSegmentSelection,
  _disableDragSelection,
  _onSegmentClick,
  _isSegmentRecorded,
  onCanPaste
) => {
  capturedOnWSReady = onReady;
  capturedOnWSRegion = onRegion;
  capturedOnWSCanUndo = onCanUndo;
  capturedOnPlayStatus = onPlayStatus;
  capturedOnCurrentRegion = onCurrentRegion;
  capturedOnCanPaste = onCanPaste;
  return waveSurferMock as unknown as ReturnType<UseWaveSurfer>;
};

jest.mock('../crud/useWaveSurfer', () => ({
  useWaveSurfer: (...args: Parameters<UseWaveSurfer>) =>
    mockUseWaveSurfer(...args),
}));

let capturedOnRecordError:
  ((e: { deviceLost?: boolean; deviceId?: string }) => void) | undefined;
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
    copyRegion: 'Copy [{0}]',
    cutRegion: 'Cut [{0}]',
    pasteRegion: 'Paste [{0}]',
    changeFailed: 'Could not update the recording: {0}',
    cutFailed: 'Cut failed: {0}',
    pasteFailed: 'Paste failed: {0}',
    undoFailed: 'Undo failed: {0}',
    recordStartFailed: 'Recording could not start: {0}',
    reduceNoise: 'Reduce noise',
    downloadMedia: 'Download',
    microphoneDisconnected:
      'The microphone was disconnected. Select another microphone to record.',
    microphoneDisconnectedFallback:
      'The preferred microphone was disconnected. Default microphone selected.',
    mustBeOnline: 'You must be online to use this feature',
    getString: (key: string) => key,
  }),
  shallowEqual: jest.fn(),
}));

jest.mock('../selector', () => ({
  wsAudioPlayerSelector: jest.fn(),
  audioDownloadSelector: jest.fn(),
  sharedSelector: jest.fn(),
}));

const mockSetGlobal = jest.fn();
const mockGlobals: Record<string, unknown> = {};
jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => [mockGlobals[key], mockSetGlobal],
}));

jest.mock('../crud/useRole', () => ({
  useRole: () => ({ userIsSharedContentCreator: false }),
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

const mockGetOrgDefault = jest.fn();
jest.mock('../crud/useOrgDefaults', () => ({
  useOrgDefaults: () => ({
    getOrgDefault: (key: unknown) => mockGetOrgDefault(key),
  }),
  orgDefaultFeatures: {},
  orgDefaultVoices: {},
}));

const mockRequestAudioAi =
  jest.fn<(request: { cb: (file: File | Error) => void }) => Promise<void>>();
jest.mock('../utils/useAudioAi', () => ({
  AudioAiFunc: {
    noiseRemoval: 'noiseremoval',
    voiceConversion: 'voiceconversion',
  },
  useAudioAi: () => ({
    requestAudioAi: (request: { cb: (file: File | Error) => void }) =>
      mockRequestAudioAi(request),
  }),
}));

const mockLogError = jest.fn();
const mockCheckOnline = jest.fn<(cb: (online: boolean) => void) => void>();
jest.mock('../utils', () => ({
  dataPath: jest.fn(),
  PathType: { MEDIA: 'media' },
  Severity: { error: 'error' },
  useCheckOnline: () => (cb: (online: boolean) => void) => mockCheckOnline(cb),
  LocalKey: { microphoneId: 'microphoneId' },
  localUserKey: (key: string) => key,
  useMobile: () => ({ isMobile: false, isMobileWidth: false }),
  logError: (...args: unknown[]) => mockLogError(...args),
  aeroTaskErrorParts: (_detail: string, summary: string) => ({
    summary,
    details: '',
  }),
  axiosErrorMessage: (error: { message?: string }) => error.message ?? '',
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

jest.mock('../control/NoChickenIcon', () => ({
  __esModule: true,
  default: () => null,
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
    capturedOnWSRegion = undefined;
    capturedOnPlayStatus = undefined;
    capturedOnWSCanUndo = undefined;
    capturedOnCurrentRegion = undefined;
    capturedOnCanPaste = undefined;
    (waveSurferMock.wsPaste as jest.Mock).mockImplementation(async () => true);
    (waveSurferMock.wsHasClipboard as jest.Mock).mockImplementation(
      () => false
    );
    (waveSurferMock.wsCopyRegion as jest.Mock).mockImplementation(() => true);
    (waveSurferMock.wsLoad as jest.Mock).mockImplementation(
      async () => undefined
    );
    mockGlobals.organization = undefined;
    mockCheckOnline.mockReset();
    mockRequestAudioAi.mockReset();
    mockRequestAudioAi.mockImplementation(() => Promise.resolve());
    mockGetOrgDefault.mockReset();
  });

  afterEach(() => {
    cleanup();
    (waveSurferMock.wsDuration as jest.Mock).mockReturnValue(0);
  });

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

  const latestHotkey = (key: string) => {
    const calls = mockSubscribe.mock.calls.filter((call) => call[0] === key);
    return calls[calls.length - 1][1] as () => boolean;
  };

  it('copies and pastes from the record hotkeys', () => {
    (waveSurferMock.wsHasClipboard as jest.Mock).mockReturnValue(false);
    render(<WSAudioPlayer {...defaultProps} />);

    expect(latestHotkey('CTRL+V')()).toBe(false);
    expect(waveSurferMock.wsPaste).not.toHaveBeenCalled();

    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnCurrentRegion?.({ start: 0, end: 1 }, 0);
      capturedOnWSRegion?.(1, true);
      capturedOnCanPaste?.(true);
    });
    expect(latestHotkey('CTRL+C')()).toBe(true);
    expect(waveSurferMock.wsCopyRegion).toHaveBeenCalled();
    expect(latestHotkey('CTRL+V')()).toBe(true);
    expect(waveSurferMock.wsPaste).toHaveBeenCalled();

    expect(latestHotkey('CTRL+X')()).toBe(true);
    expect(waveSurferMock.wsRegionDelete).toHaveBeenCalled();
  });

  it('disables copy and cut when no region is selected', () => {
    render(<WSAudioPlayer {...defaultProps} />);
    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnWSRegion?.(1, true);
    });

    expect(
      screen.getByRole('button', { name: 'Copy [CTRL+C]' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cut [CTRL+X]' })).toBeDisabled();
    expect(latestHotkey('CTRL+C')()).toBe(false);
    expect(latestHotkey('CTRL+X')()).toBe(false);
    expect(waveSurferMock.wsCopyRegion).not.toHaveBeenCalled();
    expect(waveSurferMock.wsRegionDelete).not.toHaveBeenCalled();

    act(() => {
      capturedOnCurrentRegion?.({ start: 0, end: 1 }, 0);
    });
    expect(screen.getByRole('button', { name: 'Copy [CTRL+C]' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cut [CTRL+X]' })).toBeEnabled();
    expect(latestHotkey('CTRL+C')()).toBe(true);
    expect(latestHotkey('CTRL+X')()).toBe(true);

    act(() => {
      capturedOnCurrentRegion?.(undefined);
    });
    expect(
      screen.getByRole('button', { name: 'Copy [CTRL+C]' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cut [CTRL+X]' })).toBeDisabled();
    expect(latestHotkey('CTRL+C')()).toBe(false);
    expect(latestHotkey('CTRL+X')()).toBe(false);
  });

  it('disables copy, cut, and paste until the player is ready', () => {
    const blob = new Blob([new Uint8Array([1])], { type: 'audio/wav' });
    render(<WSAudioPlayer {...defaultProps} loading={false} blob={blob} />);
    act(() => {
      capturedOnWSRegion?.(1, true);
      capturedOnCurrentRegion?.({ start: 0, end: 1 }, 0);
      capturedOnCanPaste?.(true);
    });

    expect(
      screen.getByRole('button', { name: 'Copy [CTRL+C]' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cut [CTRL+X]' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Paste [CTRL+V]' })
    ).toBeDisabled();
    expect(latestHotkey('CTRL+C')()).toBe(false);
    expect(latestHotkey('CTRL+X')()).toBe(false);
    expect(latestHotkey('CTRL+V')()).toBe(false);
    expect(waveSurferMock.wsCopyRegion).not.toHaveBeenCalled();
    expect(waveSurferMock.wsRegionDelete).not.toHaveBeenCalled();
    expect(waveSurferMock.wsPaste).not.toHaveBeenCalled();
  });

  it('does not cut while a replacement blob is still loading', async () => {
    let releaseLoad: () => void = () => undefined;
    (waveSurferMock.wsLoad as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseLoad = resolve;
        })
    );
    const first = new Blob([new Uint8Array([1])], { type: 'audio/wav' });
    const { rerender } = render(
      <WSAudioPlayer {...defaultProps} loading={false} blob={first} />
    );
    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnCurrentRegion?.({ start: 0, end: 1 }, 0);
    });

    const second = new Blob([new Uint8Array([2])], { type: 'audio/wav' });
    rerender(<WSAudioPlayer {...defaultProps} loading={false} blob={second} />);
    // The outgoing region can still be reported while the new blob decodes.
    act(() => {
      capturedOnWSRegion?.(1, true);
      capturedOnCurrentRegion?.({ start: 0, end: 1 }, 0);
    });

    expect(
      screen.getByRole('button', { name: 'Copy [CTRL+C]' })
    ).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cut [CTRL+X]' })).toBeDisabled();
    expect(latestHotkey('CTRL+C')()).toBe(false);
    expect(latestHotkey('CTRL+X')()).toBe(false);
    expect(waveSurferMock.wsCopyRegion).not.toHaveBeenCalled();
    expect(waveSurferMock.wsRegionDelete).not.toHaveBeenCalled();

    await act(async () => {
      releaseLoad();
    });
  });

  it('drops the previous selection once the replacement audio is ready', async () => {
    let releaseLoad: () => void = () => undefined;
    (waveSurferMock.wsLoad as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseLoad = resolve;
        })
    );
    const first = new Blob([new Uint8Array([1])], { type: 'audio/wav' });
    const { rerender } = render(
      <WSAudioPlayer {...defaultProps} loading={false} blob={first} />
    );
    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnCurrentRegion?.({ start: 0, end: 1 }, 0);
    });

    const second = new Blob([new Uint8Array([2])], { type: 'audio/wav' });
    rerender(<WSAudioPlayer {...defaultProps} loading={false} blob={second} />);
    await act(async () => {
      releaseLoad();
    });
    act(() => {
      capturedOnWSReady?.(8, false);
    });

    expect(latestHotkey('CTRL+X')()).toBe(false);
    expect(waveSurferMock.wsRegionDelete).not.toHaveBeenCalled();
  });

  it('does not cut while audio is playing', () => {
    render(<WSAudioPlayer {...defaultProps} />);
    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnWSRegion?.(1, true);
      capturedOnCurrentRegion?.({ start: 0, end: 1 }, 0);
      capturedOnPlayStatus?.(true);
    });

    expect(screen.getByRole('button', { name: 'Copy [CTRL+C]' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Cut [CTRL+X]' })).toBeDisabled();
    expect(latestHotkey('CTRL+X')()).toBe(false);
    expect(waveSurferMock.wsRegionDelete).not.toHaveBeenCalled();
  });

  it('does not cut while save is in progress', () => {
    render(<WSAudioPlayer {...defaultProps} mediaSaveInProgress />);
    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnWSRegion?.(1, true);
      capturedOnCurrentRegion?.({ start: 0, end: 1 }, 0);
    });

    expect(screen.getByRole('button', { name: 'Cut [CTRL+X]' })).toBeDisabled();
    expect(latestHotkey('CTRL+X')()).toBe(false);
    expect(waveSurferMock.wsRegionDelete).not.toHaveBeenCalled();
  });

  it('does not cut while the player is busy', () => {
    render(<WSAudioPlayer {...defaultProps} busy />);
    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnWSRegion?.(1, true);
      capturedOnCurrentRegion?.({ start: 0, end: 1 }, 0);
    });

    expect(screen.getByRole('button', { name: 'Cut [CTRL+X]' })).toBeDisabled();
    expect(latestHotkey('CTRL+X')()).toBe(false);
    expect(waveSurferMock.wsRegionDelete).not.toHaveBeenCalled();
  });

  it('does not paste while audio is playing', () => {
    render(<WSAudioPlayer {...defaultProps} />);
    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnCanPaste?.(true);
      capturedOnPlayStatus?.(true);
    });

    expect(
      screen.getByRole('button', { name: 'Paste [CTRL+V]' })
    ).toBeDisabled();
    expect(latestHotkey('CTRL+V')()).toBe(false);
    expect(waveSurferMock.wsPaste).not.toHaveBeenCalled();
  });

  it('does not paste while save is in progress', () => {
    render(<WSAudioPlayer {...defaultProps} mediaSaveInProgress />);

    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnCanPaste?.(true);
    });

    expect(
      screen.getByRole('button', { name: 'Paste [CTRL+V]' })
    ).toBeDisabled();
    expect(latestHotkey('CTRL+V')()).toBe(false);
    expect(waveSurferMock.wsPaste).not.toHaveBeenCalled();
  });

  it('does not copy while a paste is in progress', async () => {
    let resolvePaste: (value: boolean) => void = () => undefined;
    (waveSurferMock.wsPaste as jest.Mock).mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePaste = resolve;
        })
    );
    render(<WSAudioPlayer {...defaultProps} />);
    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnWSRegion?.(1, true);
      capturedOnCurrentRegion?.({ start: 0, end: 1 }, 0);
      capturedOnCanPaste?.(true);
    });

    expect(screen.getByRole('button', { name: 'Copy [CTRL+C]' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Paste [CTRL+V]' }));

    expect(
      screen.getByRole('button', { name: 'Copy [CTRL+C]' })
    ).toBeDisabled();
    expect(latestHotkey('CTRL+C')()).toBe(false);
    expect(waveSurferMock.wsCopyRegion).not.toHaveBeenCalled();

    await act(async () => {
      resolvePaste(true);
    });
    expect(screen.getByRole('button', { name: 'Copy [CTRL+C]' })).toBeEnabled();
  });

  it('does not paste twice from a double click', async () => {
    let resolvePaste: (value: boolean) => void = () => undefined;
    (waveSurferMock.wsPaste as jest.Mock).mockImplementation(
      () =>
        new Promise<boolean>((resolve) => {
          resolvePaste = resolve;
        })
    );
    render(<WSAudioPlayer {...defaultProps} />);
    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnCanPaste?.(true);
    });

    const paste = screen.getByRole('button', { name: 'Paste [CTRL+V]' });
    fireEvent.click(paste);
    fireEvent.click(paste);
    expect(waveSurferMock.wsPaste).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePaste(true);
    });
    fireEvent.click(paste);
    expect(waveSurferMock.wsPaste).toHaveBeenCalledTimes(2);
  });

  function expectReported(message: string) {
    expect(mockLogError).toHaveBeenCalledWith(
      'error',
      undefined,
      expect.objectContaining({ message: 'boom' })
    );
    expect(mockShowMessage).toHaveBeenCalledWith(message, 'error');
  }

  it('reports a cut failure', async () => {
    (waveSurferMock.wsRegionDelete as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('boom'))
    );
    render(<WSAudioPlayer {...defaultProps} />);
    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnWSRegion?.(1, true);
      capturedOnCurrentRegion?.({ start: 0, end: 1 }, 0);
    });

    await act(async () => {
      latestHotkey('CTRL+X')();
    });

    expectReported('Cut failed: boom');
  });

  it('reports a paste failure', async () => {
    (waveSurferMock.wsPaste as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('boom'))
    );
    render(<WSAudioPlayer {...defaultProps} />);
    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnCanPaste?.(true);
    });

    await act(async () => {
      latestHotkey('CTRL+V')();
    });

    expectReported('Paste failed: boom');
  });

  it('reports an undo failure', async () => {
    (waveSurferMock.wsUndo as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('boom'))
    );
    render(<WSAudioPlayer {...defaultProps} />);
    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnWSCanUndo?.(true);
    });

    await act(async () => {
      fireEvent.click(document.getElementById('wsUndo') as HTMLElement);
    });

    expectReported('Undo failed: boom');
  });

  it('reports a recording start failure', async () => {
    mockStartRecording.mockImplementationOnce(() =>
      Promise.reject(new Error('boom'))
    );
    render(<WSAudioPlayer {...defaultProps} />);
    act(() => {
      capturedOnWSReady?.(10, false);
    });

    await act(async () => {
      latestHotkey(RECORD_KEY)();
    });

    expectReported('Recording could not start: boom');
  });

  it('reports a failed edit and leaves Save disabled', async () => {
    let blobReady = true;
    const setBlobReady = (ready: boolean) => {
      blobReady = ready;
    };
    const onBlobReady = jest.fn();
    (waveSurferMock.wsBlob as jest.Mock).mockImplementationOnce(() =>
      Promise.reject(new Error('boom'))
    );
    (waveSurferMock.wsDuration as jest.Mock).mockReturnValue(10);
    const props = {
      ...defaultProps,
      setBlobReady,
      onBlobReady,
      handleSave: () => undefined,
      showWaveformSave: true,
    };
    const view = render(
      <WSAudioPlayer {...props} isSaveDisabled={!blobReady} />
    );
    act(() => {
      capturedOnWSReady?.(10, false);
      capturedOnWSRegion?.(1, true);
      capturedOnCurrentRegion?.({ start: 0, end: 1 }, 0);
    });
    view.rerender(<WSAudioPlayer {...props} isSaveDisabled={!blobReady} />);
    expect(document.getElementById('rec-save')).toBeEnabled();

    await act(async () => {
      latestHotkey('CTRL+X')();
    });
    view.rerender(<WSAudioPlayer {...props} isSaveDisabled={!blobReady} />);

    expect(onBlobReady).not.toHaveBeenCalled();
    expect(document.getElementById('rec-save')).toBeDisabled();
    expectReported('Could not update the recording: boom');
  });

  it('does not copy or paste while a text field is focused', () => {
    render(<WSAudioPlayer {...defaultProps} />);
    act(() => {
      capturedOnWSRegion?.(1, true);
    });
    (waveSurferMock.wsHasClipboard as jest.Mock).mockReturnValue(true);
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    expect(latestHotkey('CTRL+C')()).toBe(false);
    expect(latestHotkey('CTRL+X')()).toBe(false);
    expect(latestHotkey('CTRL+V')()).toBe(false);
    expect(waveSurferMock.wsCopyRegion).not.toHaveBeenCalled();
    expect(waveSurferMock.wsRegionDelete).not.toHaveBeenCalled();
    expect(waveSurferMock.wsPaste).not.toHaveBeenCalled();

    input.remove();
  });

  it('unsubscribes copy and paste when allowRecord is false', () => {
    const { rerender } = render(<WSAudioPlayer {...defaultProps} />);
    rerender(
      <WSAudioPlayer {...defaultProps} allowRecord={false} loading={false} />
    );

    expect(mockUnsubscribe).toHaveBeenCalledWith('CTRL+C');
    expect(mockUnsubscribe).toHaveBeenCalledWith('CTRL+X');
    expect(mockUnsubscribe).toHaveBeenCalledWith('CTRL+V');
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

  async function startNoiseRemoval(setBusy: (busy: boolean) => void) {
    mockGlobals.organization = 'org';
    mockGetOrgDefault.mockReturnValue({ noNoise: true });
    mockCheckOnline.mockImplementation((cb: (online: boolean) => void) => {
      cb(true);
    });
    (waveSurferMock.wsRegionBlob as jest.Mock).mockImplementation(
      async () => new Blob([new Uint8Array([1])], { type: 'audio/wav' })
    );
    render(
      <WSAudioPlayer
        {...defaultProps}
        allowNoNoise
        reload={jest.fn()}
        setBusy={setBusy}
      />
    );
    act(() => {
      capturedOnWSReady?.(10, false);
    });
    fireEvent.click(document.getElementById('wsAudioMore') as HTMLElement);
    fireEvent.click(document.getElementById('noiseRemoval') as HTMLElement);
    await act(async () => {
      await Promise.resolve();
    });
  }

  it('keeps AI busy until the region replace finishes', async () => {
    let aiCallback: ((file: File | Error) => void) | undefined;
    let resolveReplace: (blob: Blob) => void = () => undefined;
    (waveSurferMock.wsRegionReplace as jest.Mock).mockImplementation(
      () =>
        new Promise<Blob>((resolve) => {
          resolveReplace = resolve;
        })
    );
    mockRequestAudioAi.mockImplementation(
      (request: { cb: (file: File | Error) => void }) => {
        aiCallback = request.cb;
        return Promise.resolve();
      }
    );
    await startNoiseRemoval(jest.fn());
    expect(screen.getByText('AI in progress')).toBeTruthy();

    act(() => {
      aiCallback?.(new File(['ai'], 'ai.wav', { type: 'audio/wav' }));
    });
    expect(screen.getByText('AI in progress')).toBeTruthy();

    await act(async () => {
      resolveReplace(new Blob([new Uint8Array([2])], { type: 'audio/wav' }));
    });
    expect(screen.queryByText('AI in progress')).toBeNull();
  });

  it('clears AI busy once when the AI result is an error', async () => {
    let aiCallback: ((file: File | Error) => void) | undefined;
    mockRequestAudioAi.mockImplementation(
      (request: { cb: (file: File | Error) => void }) => {
        aiCallback = request.cb;
        return Promise.resolve();
      }
    );
    const setBusy = jest.fn();
    await startNoiseRemoval(setBusy);
    const falseCalls = () =>
      setBusy.mock.calls.filter((call) => call[0] === false).length;
    const before = falseCalls();

    act(() => {
      aiCallback?.(new Error('failed'));
    });

    expect(falseCalls() - before).toBe(1);
    expect(screen.queryByText('AI in progress')).toBeNull();
  });

  async function deliverAiError(error: Error) {
    let aiCallback: ((file: File | Error) => void) | undefined;
    mockRequestAudioAi.mockImplementation(
      (request: { cb: (file: File | Error) => void }) => {
        aiCallback = request.cb;
        return Promise.resolve();
      }
    );
    await startNoiseRemoval(jest.fn());
    mockShowMessage.mockClear();
    act(() => {
      aiCallback?.(error);
    });
  }

  it('shows the online message when AI is skipped offline', async () => {
    await deliverAiError(new AudioAiError(AudioAiErrorCode.offline));
    expect(mockShowMessage).toHaveBeenCalledWith(
      'You must be online to use this feature',
      'error'
    );
  });

  it('shows the online message when AI is skipped with no token', async () => {
    await deliverAiError(new AudioAiError(AudioAiErrorCode.noToken));
    expect(mockShowMessage).toHaveBeenCalledWith(
      'You must be online to use this feature',
      'error'
    );
  });

  it('does not toast when AI is canceled', async () => {
    await deliverAiError(new AudioAiError(AudioAiErrorCode.canceled));
    expect(mockShowMessage).not.toHaveBeenCalled();
    expect(screen.queryByText('AI in progress')).toBeNull();
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
      .fn<() => Promise<MediaDeviceInfo[]>>()
      .mockResolvedValueOnce([headset, laptop] as MediaDeviceInfo[])
      .mockResolvedValue([laptop] as MediaDeviceInfo[]);
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
