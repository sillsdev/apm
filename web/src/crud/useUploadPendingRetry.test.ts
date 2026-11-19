import { act, renderHook, waitFor } from '@testing-library/react';
import { UploadType } from '../components/UploadType';
import type { UploadPendingEntry } from '../store/upload/uploadPendingBlobs';

let mockIsElectron = false;
const mockGlobals: Record<string, unknown> = {};
const mockNextUpload = jest.fn();
const mockListUploadPendingEntries = jest.fn();
const mockCompletePendingUploadRetry = jest.fn();
const mockLogError = jest.fn();

jest.mock('../../api-variable', () => ({
  get isElectron() {
    return mockIsElectron;
  },
}));

jest.mock('react-redux', () => ({
  useDispatch: () => jest.fn(),
}));

jest.mock('../context/useGlobal', () => ({
  useGetGlobal: () => (key: string) => mockGlobals[key],
  useGlobal: (key: string) => [mockGlobals[key], jest.fn()],
}));

jest.mock('../context/TokenProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TokenContext: React.createContext({ state: { accessToken: 'tok' } }),
  };
});

jest.mock('../store', () => ({
  nextUpload: (...args: unknown[]) => mockNextUpload(...args),
}));

jest.mock('../store/upload/completePendingUploadRetry', () => ({
  completePendingUploadRetry: (...args: unknown[]) =>
    mockCompletePendingUploadRetry(...args),
}));

// drainUploadPending runs for real; it reads the in-flight set from here.
jest.mock('../store/upload/uploadPendingBlobs', () => ({
  listUploadPendingEntries: (...args: unknown[]) =>
    mockListUploadPendingEntries(...args),
  isUploadPendingInFlight: () => false,
}));

jest.mock('../utils/infoMsg', () => ({
  infoMsg: (err: Error, msg: string) => Object.assign(err, { message: msg }),
}));

jest.mock('../utils/logErrorService', () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
  Severity: { error: 1 },
}));

const mockRequestBackgroundSync = jest.fn(async () => undefined);
jest.mock('../store/upload/uploadPendingBackgroundSync', () => ({
  ...jest.requireActual<
    typeof import('../store/upload/uploadPendingBackgroundSync')
  >('../store/upload/uploadPendingBackgroundSync'),
  requestUploadPendingBackgroundSync: () => mockRequestBackgroundSync(),
}));

import { useUploadPendingRetry } from './useUploadPendingRetry';

type NextUploadProps = {
  pendingUploadIdToClearOnSuccess: string;
  projectId: string;
  cb: (n: number, success: boolean, data?: unknown) => Promise<void>;
};

const entry = (key: string, projectId = 'proj-1'): UploadPendingEntry => ({
  key,
  projectId,
  file: new File(['a'], `${key}.webm`),
  retryCount: 0,
  request: {
    uploadType: UploadType.Media,
    record: {
      planId: 'plan-1',
      originalFile: `${key}.webm`,
      contentType: 'audio/webm',
    } as UploadPendingEntry['request']['record'],
  },
});

/** Keys of the Upload Pending recordings the hook sent to nextUpload. */
const uploadedKeys = () =>
  mockNextUpload.mock.calls.map(
    ([props]: [NextUploadProps]) => props.pendingUploadIdToClearOnSuccess
  );

const uploadsSucceed = () =>
  mockNextUpload.mockImplementation((props: NextUploadProps) => {
    void props.cb(0, true, {
      stringId: `mf-${props.pendingUploadIdToClearOnSuccess}`,
    });
    return { type: 'NEXT_UPLOAD' };
  });

const uploadsFail = () =>
  mockNextUpload.mockImplementation((props: NextUploadProps) => {
    void props.cb(0, false);
    return { type: 'NEXT_UPLOAD' };
  });

/** Uploads stay in flight until the test finishes them, oldest first. */
const uploadsWaitForTest = () => {
  const inFlight: Array<(ok: boolean) => Promise<void>> = [];
  mockNextUpload.mockImplementation((props: NextUploadProps) => {
    inFlight.push((ok) => props.cb(0, ok, ok ? { stringId: 'mf' } : undefined));
    return { type: 'NEXT_UPLOAD' };
  });
  return async (ok = true) => {
    await act(async () => {
      await inFlight.shift()?.(ok);
    });
  };
};

const setOnline = (value: boolean) =>
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });

describe('useUploadPendingRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsElectron = false;
    setOnline(true);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
      },
    });
    Object.assign(mockGlobals, {
      project: 'proj-1',
      coordinator: { getSource: (name: string) => ({ name }) },
      errorReporter: 'reporter',
      importexportBusy: false,
      user: 'user-1',
    });
    mockListUploadPendingEntries.mockResolvedValue([]);
    mockCompletePendingUploadRetry.mockResolvedValue(undefined);
    uploadsSucceed();
  });

  it('uploads the open project’s Upload Pending recordings, oldest first', async () => {
    mockListUploadPendingEntries.mockResolvedValue([entry('a'), entry('b')]);

    renderHook(() => useUploadPendingRetry());

    await waitFor(() => expect(uploadedKeys()).toEqual(['a', 'b']));
    expect(mockListUploadPendingEntries).toHaveBeenCalledWith('proj-1');
    expect(mockCompletePendingUploadRetry).toHaveBeenCalledWith(
      expect.objectContaining({ stringId: 'mf-a' })
    );
  });

  it('requestDrain returns while an upload is still in flight', async () => {
    const finishNext = uploadsWaitForTest();
    const { result } = renderHook(() => useUploadPendingRetry());
    await waitFor(() =>
      expect(mockListUploadPendingEntries).toHaveBeenCalled()
    );
    mockListUploadPendingEntries.mockResolvedValue([entry('a'), entry('b')]);

    act(() => result.current.requestDrain());

    // 'a' is in flight and 'b' waits for it; requestDrain has already returned.
    await waitFor(() => expect(uploadedKeys()).toEqual(['a']));
    await finishNext();
    await waitFor(() => expect(uploadedKeys()).toEqual(['a', 'b']));
    await finishNext();
  });

  it('stops at a failed upload and retries it on the next request', async () => {
    uploadsFail();
    mockListUploadPendingEntries.mockResolvedValue([entry('a'), entry('b')]);
    const { result } = renderHook(() => useUploadPendingRetry());
    await waitFor(() => expect(uploadedKeys()).toEqual(['a']));

    uploadsSucceed();
    act(() => result.current.requestDrain());

    await waitFor(() => expect(uploadedKeys()).toEqual(['a', 'a', 'b']));
    expect(mockLogError).not.toHaveBeenCalled();
  });

  it('reports a failed listing and still drains on the next request', async () => {
    mockListUploadPendingEntries.mockRejectedValueOnce(new Error('idb'));
    const { result } = renderHook(() => useUploadPendingRetry());
    await waitFor(() => expect(mockLogError).toHaveBeenCalledTimes(1));

    mockListUploadPendingEntries.mockResolvedValue([entry('a')]);
    act(() => result.current.requestDrain());

    await waitFor(() => expect(uploadedKeys()).toEqual(['a']));
  });

  it('waits for the online event when the browser is offline', async () => {
    setOnline(false);
    mockListUploadPendingEntries.mockResolvedValue([entry('a')]);
    renderHook(() => useUploadPendingRetry());
    await act(async () => {});
    expect(mockListUploadPendingEntries).not.toHaveBeenCalled();

    setOnline(true);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(uploadedKeys()).toEqual(['a']));
  });

  it('runs one more pass for requests made during a drain', async () => {
    const finishNext = uploadsWaitForTest();
    // Each pass lists the queue, then lists what is left.
    mockListUploadPendingEntries
      .mockResolvedValueOnce([entry('a')])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([entry('saved-mid-drain')]);
    const { result } = renderHook(() => useUploadPendingRetry());
    await waitFor(() => expect(uploadedKeys()).toEqual(['a']));

    act(() => {
      result.current.requestDrain();
      result.current.requestDrain();
    });
    await finishNext();

    await waitFor(() =>
      expect(uploadedKeys()).toEqual(['a', 'saved-mid-drain'])
    );
    await finishNext();
    await waitFor(() =>
      expect(mockListUploadPendingEntries).toHaveBeenCalledTimes(4)
    );
  });

  it('drains a newly opened project after the previous project’s drain', async () => {
    const finishNext = uploadsWaitForTest();
    mockListUploadPendingEntries.mockImplementation(
      async (projectId: string) =>
        projectId === 'proj-1' ? [entry('a')] : [entry('x', 'proj-2')]
    );
    const { rerender } = renderHook(() => useUploadPendingRetry());
    await waitFor(() => expect(uploadedKeys()).toEqual(['a']));

    mockGlobals.project = 'proj-2';
    rerender();
    await finishNext();

    await waitFor(() => expect(uploadedKeys()).toEqual(['a', 'x']));
    expect(mockListUploadPendingEntries).toHaveBeenLastCalledWith('proj-2');
    await finishNext();
  });

  it('does nothing on desktop', async () => {
    mockIsElectron = true;
    mockListUploadPendingEntries.mockResolvedValue([entry('a')]);
    const { result } = renderHook(() => useUploadPendingRetry());

    act(() => result.current.requestDrain());
    await act(async () => {});

    expect(mockListUploadPendingEntries).not.toHaveBeenCalled();
    expect(mockNextUpload).not.toHaveBeenCalled();
  });

  /** Captures the hook's service worker message listener. */
  const captureSwListener = () => {
    const listeners: Array<(event: MessageEvent) => void> = [];
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        addEventListener: (
          type: string,
          listener: (event: MessageEvent) => void
        ) => {
          if (type === 'message') listeners.push(listener);
        },
        removeEventListener: jest.fn(),
      },
    });
    /** Sends the drain message; resolves with the reply on its port. */
    return (data: unknown = { type: 'UPLOAD_PENDING_DRAIN' }) =>
      new Promise<unknown>((resolve) => {
        const port = { postMessage: resolve };
        act(() => {
          listeners.forEach((listener) =>
            listener({ data, ports: [port] } as unknown as MessageEvent)
          );
        });
      });
  };

  it('drains when the service worker asks and replies drained', async () => {
    const sendSwDrain = captureSwListener();
    renderHook(() => useUploadPendingRetry());
    await waitFor(() =>
      expect(mockListUploadPendingEntries).toHaveBeenCalled()
    );
    mockListUploadPendingEntries
      .mockResolvedValueOnce([entry('from-sw')])
      .mockResolvedValueOnce([]);

    const reply = await sendSwDrain();

    expect(uploadedKeys()).toEqual(['from-sw']);
    expect(reply).toEqual({ result: 'drained' });
  });

  it('replies pending when an upload fails, so the sync retries', async () => {
    uploadsFail();
    const sendSwDrain = captureSwListener();
    mockListUploadPendingEntries.mockResolvedValue([entry('a')]);
    renderHook(() => useUploadPendingRetry());

    await expect(sendSwDrain()).resolves.toEqual({ result: 'pending' });
  });

  it('replies skipped when no project is open', async () => {
    mockGlobals.project = '';
    const sendSwDrain = captureSwListener();
    renderHook(() => useUploadPendingRetry());

    await expect(sendSwDrain()).resolves.toEqual({ result: 'skipped' });
    expect(mockListUploadPendingEntries).not.toHaveBeenCalled();
  });

  it('ignores other service worker messages', async () => {
    const sendSwDrain = captureSwListener();
    renderHook(() => useUploadPendingRetry());
    await waitFor(() =>
      expect(mockListUploadPendingEntries).toHaveBeenCalled()
    );
    mockListUploadPendingEntries.mockClear();

    void sendSwDrain({ type: 'SKIP_WAITING' });
    await act(async () => {});

    expect(mockListUploadPendingEntries).not.toHaveBeenCalled();
  });

  it('registers Background Sync only while offline', async () => {
    setOnline(false);
    renderHook(() => useUploadPendingRetry());
    await waitFor(() =>
      expect(mockRequestBackgroundSync).toHaveBeenCalledTimes(1)
    );

    setOnline(true);
    uploadsFail();
    mockListUploadPendingEntries.mockResolvedValue([entry('a')]);
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    await waitFor(() => expect(uploadedKeys()).toEqual(['a']));
    expect(mockRequestBackgroundSync).toHaveBeenCalledTimes(1);
  });
});
