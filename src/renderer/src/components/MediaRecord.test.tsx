// eslint-disable-next-line @typescript-eslint/no-unused-vars
import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import MediaRecord from './MediaRecord';

type WsAudioPlayerProps = {
  planId?: string;
  setChanged?: (changed: boolean) => void;
  onDuration?: (duration: number) => void;
  setBlobReady?: (ready: boolean) => void;
  onBlobReady?: (blob: Blob | undefined) => void;
  isSaveDisabled?: boolean;
  showWaveformSave?: boolean;
};

let latestWsProps: WsAudioPlayerProps | undefined;
let mockSaveRequested: () => boolean;
let mockUploadMedia: jest.Mock;
let mockConvertToFormat: jest.Mock;
/** MediaRecord's own myAfterUploadCb, captured from the useMediaUpload props. */
let capturedAfterUploadCb: ((mediaId: string) => Promise<void>) | undefined;

jest.mock('../utils/typeLimit', () => ({
  typeLimit: () => 1,
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
  useMediaUpload: (props: {
    afterUploadCb: (mediaId: string) => Promise<void>;
  }) => {
    capturedAfterUploadCb = props.afterUploadCb;
    return (files: File[]) => mockUploadMedia(files);
  },
  convertToFormat: (blob: Blob, mimeType: string) =>
    mockConvertToFormat(blob, mimeType),
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
        saveRequested: () => mockSaveRequested(),
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
        processing: 'Processing...',
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
  artifactTypeSlug: null,
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
    capturedAfterUploadCb = undefined;
    jest.clearAllMocks();
    mockSaveRequested = () => false;
    mockUploadMedia = jest.fn().mockResolvedValue(undefined);
    mockConvertToFormat = jest.fn((blob: Blob) => Promise.resolve(blob));
  });

  afterEach(() => {
    cleanup();
  });

  it('passes planId through to WSAudioPlayer', async () => {
    render(<MediaRecord {...defaultProps} planId="plan-1" />);

    await waitFor(() => {
      expect(latestWsProps?.planId).toBe('plan-1');
    });
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

  it('shows save but does not enable upload when blob exceeds size limit', async () => {
    const setCanSave = jest.fn();
    const hugeBlob = new Blob([new Uint8Array(21 * 1000000)], {
      type: 'audio/ogg',
    });
    render(<MediaRecord {...defaultProps} setCanSave={setCanSave} />);

    await waitFor(() => expect(latestWsProps).toBeDefined());

    act(() => {
      latestWsProps?.setBlobReady?.(true);
      latestWsProps?.setChanged?.(true);
      latestWsProps?.onDuration?.(12);
      latestWsProps?.onBlobReady?.(hugeBlob);
    });

    await waitFor(() => {
      expect(latestWsProps?.showWaveformSave).toBe(true);
      expect(latestWsProps?.isSaveDisabled).toBe(true);
      expect(setCanSave).toHaveBeenLastCalledWith(false);
    });
  });

  /** Drives a take through a terminal upload failure. */
  const failASave = async (
    setCanSave: jest.Mock,
    onSaveRejected?: jest.Mock,
    order?: string[]
  ) => {
    mockSaveRequested = () => true;
    mockUploadMedia = jest.fn(async () => {
      order?.push('upload');
      // Mirrors nextUpload's terminal failure: afterUploadCb with no mediaId,
      // then the upload promise rejects.
      await capturedAfterUploadCb?.('');
      throw new Error('upload failed');
    });
    render(
      <MediaRecord
        {...defaultProps}
        setCanSave={setCanSave}
        onSaveRejected={onSaveRejected}
      />
    );

    await waitFor(() => expect(latestWsProps).toBeDefined());

    act(() => {
      latestWsProps?.setBlobReady?.(true);
      latestWsProps?.setChanged?.(true);
      latestWsProps?.onDuration?.(12);
      latestWsProps?.onBlobReady?.(
        new Blob([new Uint8Array(1000)], { type: 'audio/ogg' })
      );
    });

    await waitFor(() => expect(mockUploadMedia).toHaveBeenCalled());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };

  // TT-7583: parents that auto-save do so on every rising edge of canSave, and
  // a failed upload leaves the take dirty, so canSave goes false→true again.
  // MediaRecord reports the rejection instead of latching canSave off, which
  // would strand the take on screens whose Save button reads canSave.
  it('reports a rejected save to the parent', async () => {
    const onSaveRejected = jest.fn();
    await failASave(jest.fn(), onSaveRejected);

    expect(onSaveRejected).toHaveBeenCalled();
  });

  // The upload never starts on this path, so it does not go through
  // myAfterUploadCb/handleSaveFailed — it needs its own notification or an
  // auto-save parent would keep re-requesting (TT-7583).
  it('reports a save requested with no audio to the parent', async () => {
    const onSaveRejected = jest.fn();
    mockSaveRequested = () => true;
    render(<MediaRecord {...defaultProps} onSaveRejected={onSaveRejected} />);

    await waitFor(() => expect(latestWsProps).toBeDefined());

    // Save requested while the waveform holds nothing to upload.
    act(() => {
      latestWsProps?.setChanged?.(true);
    });

    await waitFor(() => expect(onSaveRejected).toHaveBeenCalled());
    expect(mockUploadMedia).not.toHaveBeenCalled();
  });

  it('reports the rejection before save becomes available again', async () => {
    const order: string[] = [];
    const setCanSave = jest.fn((v: boolean) => {
      if (v) order.push('canSave:true');
    });
    const onSaveRejected = jest.fn(() => order.push('rejected'));

    await failASave(setCanSave, onSaveRejected, order);

    // Ignore the arming edge that started this save; only what follows matters.
    const afterUpload = order.slice(order.indexOf('upload'));
    const rejected = afterUpload.indexOf('rejected');
    const rearmed = afterUpload.indexOf('canSave:true');

    // Auto-save parents act on the rising edge, so they must already know the
    // take was rejected by the time one arrives.
    expect(rejected).toBeGreaterThan(-1);
    expect(rearmed === -1 || rearmed > rejected).toBe(true);
  });

  it('keeps save available so the same take can be retried', async () => {
    const setCanSave = jest.fn();
    await failASave(setCanSave);

    // saveCompleted has cleared the request; the take is still in the waveform.
    mockSaveRequested = () => false;
    act(() => {
      latestWsProps?.setChanged?.(true);
    });

    // Screens with a manual Save button (PassageDetailRecord, PassageRecordDlg,
    // TitleRecord) gate it on canSave, and PassageDetailRecord also feeds
    // toolChanged from it. Latching it off after a transient failure would
    // leave no way to retry and no unsaved-changes warning.
    await waitFor(() => expect(setCanSave).toHaveBeenLastCalledWith(true));
  });
});
