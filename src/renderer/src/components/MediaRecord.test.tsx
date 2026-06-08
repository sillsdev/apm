import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MediaRecord from './MediaRecord';

type WsAudioPlayerProps = {
  setChanged?: (changed: boolean) => void;
  onDuration?: (duration: number) => void;
  setBlobReady?: (ready: boolean) => void;
  onBlobReady?: (blob: Blob | undefined) => void;
  isSaveDisabled?: boolean;
};

let latestWsProps: WsAudioPlayerProps | undefined;

jest.mock('./MediaUpload', () => ({
  SIZELIMIT: () => 100,
}));

jest.mock('./WSAudioPlayer', () => {
  const MockWSAudioPlayer = (props: WsAudioPlayerProps) => {
    latestWsProps = props;
    return <div data-testid="ws-audio-player" />;
  };
  MockWSAudioPlayer.displayName = 'MockWSAudioPlayer';
  return {
    __esModule: true,
    default: MockWSAudioPlayer,
    WSAudioPlayerControls: {},
  };
});

jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [undefined, jest.fn()],
}));

jest.mock('../crud', () => ({
  MediaSt: { IDLE: 0, PENDING: 1, FETCHED: 2, ERROR: 3 },
  useFetchMediaUrl: () => ({
    fetchMediaUrl: jest.fn(),
    mediaState: { status: 0, id: '', url: '', error: null },
  }),
  useMediaUpload: () => jest.fn(),
  convertToFormat: jest.fn(),
  getBlobDiagnostics: jest.fn(() => ({})),
  logAudioDiagnostic: jest.fn(),
}));

jest.mock('../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('../context/UnsavedContext', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    UnsavedContext: React.createContext({
      state: {
        toolsChanged: 0,
        saveRequested: () => false,
        saveCompleted: jest.fn(),
        clearRequested: () => false,
        clearCompleted: jest.fn(),
      },
    }),
  };
});

jest.mock('../context/usePassageDetailContext', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../crud/useStepTool', () => ({
  useStepTool: () => ({ settings: undefined }),
}));

jest.mock('../utils', () => ({
  infoMsg: jest.fn(),
  loadBlobAsync: jest.fn(),
  logError: jest.fn(),
  Severity: { error: 'error' },
  useMobile: () => ({ isMobile: false }),
  waitForIt: jest.fn(),
  JSONParse: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useSelector: (selector: { name?: string }) => {
    if (selector.name === 'passageRecordSelector') {
      return {
        saving: 'Saving',
        compressing: 'Compressing',
        compressed: 'Compressed',
        uncompressed: 'Uncompressed',
        loading: 'Loading',
        compressError: 'Compress error',
        toobig: 'Too big {1}',
        toobigwarn: 'Too big warn {1}',
      };
    }
    return { NoSaveWoMedia: 'No media to save', mediaError: 'Media error' };
  },
  shallowEqual: jest.fn(),
}));

jest.mock('../selector', () => ({
  passageRecordSelector: { name: 'passageRecordSelector' },
  sharedSelector: { name: 'sharedSelector' },
}));

const defaultProps = {
  toolId: 'record-tool',
  artifactId: 'vernacular',
  passageId: 'passage-1',
  afterUploadCb: jest.fn(),
  defaultFilename: 'recording',
  setCanSave: jest.fn(),
  setStatusText: jest.fn(),
  width: 400,
};

describe('MediaRecord save gating', () => {
  beforeEach(() => {
    latestWsProps = undefined;
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('does not enable save when duration is zero even if waveform is dirty', async () => {
    const setCanSave = jest.fn();
    render(<MediaRecord {...defaultProps} setCanSave={setCanSave} />);

    await waitFor(() => expect(latestWsProps).toBeDefined());

    act(() => {
      latestWsProps?.setBlobReady?.(true);
      latestWsProps?.setChanged?.(true);
      latestWsProps?.onDuration?.(0);
    });

    await waitFor(() => {
      expect(setCanSave).toHaveBeenLastCalledWith(false);
    });
  });

  it('enables save when duration is positive and waveform is dirty', async () => {
    const setCanSave = jest.fn();
    render(<MediaRecord {...defaultProps} setCanSave={setCanSave} />);

    await waitFor(() => expect(latestWsProps).toBeDefined());

    act(() => {
      latestWsProps?.setBlobReady?.(true);
      latestWsProps?.setChanged?.(true);
      latestWsProps?.onDuration?.(12);
    });

    await waitFor(() => {
      expect(setCanSave).toHaveBeenLastCalledWith(true);
    });
  });

  it('disables waveform save button when duration is zero', async () => {
    render(<MediaRecord {...defaultProps} isSaveDisabled={false} />);

    await waitFor(() => expect(latestWsProps).toBeDefined());

    act(() => {
      latestWsProps?.onDuration?.(0);
    });

    await waitFor(() => {
      expect(latestWsProps?.isSaveDisabled).toBe(true);
    });
  });
});
