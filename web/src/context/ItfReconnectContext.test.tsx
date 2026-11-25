/**
 * @jest-environment jsdom
 *
 * TT-7911: the reconnect ITF shows progress with a cancel, and a project
 * switch or logout waits for it like the Upload Pending leave gate.
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';

jest.mock('../../api-variable', () => ({
  API_CONFIG: { host: 'https://api.test', snagId: '' },
  OrbitNetworkErrorRetries: 5,
  isElectron: true,
}));
jest.mock('../selector', () => ({ importSelector: {}, sharedSelector: {} }));
jest.mock('react-redux', () => ({
  useSelector: () => ({
    importSyncUp: 'Syncing offline changes',
    importPending: 'Import In Progress...',
    itfReconnectSent: 'Sent.',
    itfReconnectCancelled: 'Stopped.',
    itfReconnectFailed: 'Failed.',
    itfReconnectRetry: 'Send now',
    itfReconnectLeaveWait: 'Still sending.',
    itfReconnectStopAndLeave: 'Stop and leave',
    cancel: 'Cancel',
    close: 'Close',
  }),
  shallowEqual: jest.fn(),
}));
jest.mock('./TokenProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { TokenContext: React.createContext(undefined) };
});
jest.mock('../utils/logErrorService', () => ({
  __esModule: true,
  default: jest.fn(),
  logError: jest.fn(),
  Severity: { error: 'error' },
}));
jest.mock('../auth/bugsnagClient', () => ({ __esModule: true, default: {} }));
jest.mock('../utils/infoMsg', () => ({ infoMsg: (e: Error) => e }));
jest.mock('../crud/useOfflnProjRead', () => ({
  useOfflnProjRead: () => jest.fn(),
}));
const mockForceDataChanges = jest.fn(async () => undefined);
jest.mock('../utils/useDataChanges', () => ({
  useDataChanges: () => mockForceDataChanges,
}));
jest.mock('../crud/orbitReset', () => ({
  orbitReset: jest.fn(async () => undefined),
}));
const mockExport = jest.fn();
jest.mock('../store/importexport/itfSyncExport', () => ({
  exportItfSync: () => mockExport(),
}));
const mockUpload = jest.fn();
jest.mock('../store/importexport/uploadItfSync', () => ({
  uploadItfSync: () => mockUpload(),
}));

const mockQueue = {
  autoProcess: true,
  reified: Promise.resolve(),
  entries: [],
  length: 0,
  empty: true,
  clear: jest.fn(async () => undefined),
  push: jest.fn(),
};
const mockGlobals: Record<string, unknown> = {
  loadComplete: true,
  importexportBusy: false,
  coordinator: {
    sourceNames: ['remote', 'memory', 'backup'],
    getSource: (name: string) =>
      name === 'remote' ? { requestQueue: mockQueue } : {},
  },
};
jest.mock('./useGlobal', () => ({
  useGlobal: (key: string) => [mockGlobals[key], jest.fn()],
  useGetGlobal: () => (key: string) => mockGlobals[key],
}));

import { ItfReconnectProvider } from './ItfReconnectContext';
import { useItfReconnectLeave } from './itfReconnectLeave';
import {
  cancelItfReconnect,
  dismissItfReconnect,
  runItfReconnect,
  whenItfReconnectSettled,
} from '../utils/itfReconnect';
import { markNeedItfSync, needItfSync } from '../utils/needItfSync';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
};

let guardLeave: (proceed: () => void) => void = () => undefined;
function Consumer() {
  guardLeave = useItfReconnectLeave();
  return null;
}

const renderProvider = () =>
  render(
    <ItfReconnectProvider>
      <Consumer />
    </ItfReconnectProvider>
  );

describe('ItfReconnectProvider (TT-7911)', () => {
  let upload: ReturnType<typeof deferred>;

  beforeEach(() => {
    localStorage.clear();
    markNeedItfSync();
    upload = deferred();
    mockExport.mockResolvedValue({
      buffer: Buffer.from('itf'),
      fileName: 'sync.itf',
      records: [],
    });
    mockUpload.mockImplementation(() => upload.promise);
  });
  afterEach(async () => {
    cancelItfReconnect();
    upload.resolve();
    await act(async () => {
      await whenItfReconnectSettled();
    });
    act(() => dismissItfReconnect());
  });

  const startRun = async () => {
    await act(async () => {
      void runItfReconnect();
      await new Promise((r) => setTimeout(r, 0));
    });
  };

  it('shows progress with a cancel while the ITF is sent', async () => {
    renderProvider();
    await startRun();
    expect(screen.getByText('Syncing offline changes')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      await whenItfReconnectSettled();
    });

    expect(screen.getByText('Stopped.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send now' })).toBeVisible();
    expect(needItfSync()).toBe(true);
  });

  it('reports success once the server has the ITF', async () => {
    renderProvider();
    await startRun();
    await act(async () => {
      upload.resolve();
      await whenItfReconnectSettled();
    });
    expect(screen.getByText('Sent.')).toBeInTheDocument();
    expect(needItfSync()).toBe(false);
    expect(mockForceDataChanges).toHaveBeenCalled();
  });

  it('lets the user leave at once when no ITF is running', () => {
    renderProvider();
    const proceed = jest.fn();
    act(() => guardLeave(proceed));
    expect(proceed).toHaveBeenCalledTimes(1);
  });

  it('holds a leave until the ITF finishes', async () => {
    renderProvider();
    await startRun();
    const proceed = jest.fn();
    act(() => guardLeave(proceed));

    expect(proceed).not.toHaveBeenCalled();
    expect(screen.getByText('Still sending.')).toBeInTheDocument();

    await act(async () => {
      upload.resolve();
      await whenItfReconnectSettled();
    });
    expect(proceed).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Still sending.')).not.toBeInTheDocument();
  });

  it('stays in the project when the user cancels the leave', async () => {
    renderProvider();
    await startRun();
    const proceed = jest.fn();
    act(() => guardLeave(proceed));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(
      Array.from(dialog.querySelectorAll('button')).find(
        (b) => b.textContent === 'Cancel'
      ) as HTMLButtonElement
    );

    await act(async () => {
      upload.resolve();
      await whenItfReconnectSettled();
    });
    expect(proceed).not.toHaveBeenCalled();
  });

  it('stop and leave cancels the ITF, keeps the flag, then leaves', async () => {
    renderProvider();
    await startRun();
    const proceed = jest.fn();
    act(() => guardLeave(proceed));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Stop and leave' }));
      await whenItfReconnectSettled();
    });
    expect(proceed).toHaveBeenCalledTimes(1);
    expect(needItfSync()).toBe(true);
  });
});
