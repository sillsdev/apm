import { act, render } from '@testing-library/react';

const mockGlobals: Record<string, unknown> = {};
const mockIntervalFns: Record<string, () => Promise<void> | void> = {};
const mockRequestDrain = jest.fn();
const mockDoDataChanges = jest.fn();
const mockCheckAllProjects = jest.fn();
const mockLogError = jest.fn();

jest.mock('../../api-variable', () => ({
  isElectron: false,
  OrbitNetworkErrorRetries: 3,
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
    TokenContext: React.createContext({
      state: { accessToken: 'tok', authenticated: () => true },
    }),
  };
});

jest.mock('../context/UnsavedContext', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    UnsavedContext: React.createContext({
      state: { anySaving: () => false, toolsChanged: [] },
    }),
  };
});

jest.mock('../utils', () => ({
  infoMsg: (err: Error) => err,
  logError: (...args: unknown[]) => mockLogError(...args),
  Severity: { error: 1 },
  useCheckOnline: () => jest.fn(),
}));

jest.mock('../utils/toError', () => ({
  toError: (err: unknown) => err,
}));

// Capture each interval callback by name so a test can run one sync tick.
jest.mock('../utils/useInterval', () => ({
  useInterval: (fn: () => Promise<void> | void) => {
    mockIntervalFns[fn.name] = fn;
  },
}));

jest.mock('../utils/perf', () => ({
  useRenderProfiler: () => undefined,
  perfRecordMs: () => undefined,
}));

jest.mock('../crud', () => ({
  findRecord: () => undefined,
  useFetchUrlNow: () => jest.fn(),
}));

jest.mock('../crud/useOfflnProjRead', () => ({
  useOfflnProjRead: () => jest.fn(),
}));

jest.mock('../crud/useSanityCheck', () => ({
  useSanityCheck: () => ({ checkAllProjects: mockCheckAllProjects }),
}));

jest.mock('../crud/useBibleMedia', () => ({
  useBibleMedia: () => ({
    getBibleMediaPlan: async () => undefined,
    getBibleMediaProject: async () => undefined,
  }),
}));

jest.mock('../crud/useUploadPendingRetry', () => ({
  useUploadPendingRetry: () => ({ requestDrain: mockRequestDrain }),
}));

jest.mock('../store', () => ({
  setLanguage: jest.fn(),
}));

jest.mock('../store/importexport/electronExport', () => ({
  electronExport: jest.fn(),
}));

jest.mock('../model', () => ({
  ExportType: { ITFBACKUP: 'itfbackup' },
}));

jest.mock('./useOrbitData', () => ({
  useOrbitData: () => [],
}));

jest.mock('./doDataChanges', () => ({
  doDataChanges: (...args: unknown[]) => mockDoDataChanges(...args),
}));

import { DataChanges } from './DataChanges';

/** Runs one DataChanges sync tick and waits for it to finish. */
const runSyncTick = async () => {
  await act(async () => {
    await mockIntervalFns.updateData?.();
  });
};

describe('DataChanges drains Upload Pending after a sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(mockGlobals, {
      offline: false,
      coordinator: { getSource: () => ({ requestQueue: [] }) },
      loadComplete: true,
      connected: true,
      user: 'user-1',
      fingerprint: 'fp',
      errorReporter: 'reporter',
      remoteBusy: false,
      importexportBusy: false,
      orbitRetries: 3,
      projectsLoaded: [],
      project: 'proj-1',
    });
    mockDoDataChanges.mockResolvedValue(undefined);
    mockCheckAllProjects.mockResolvedValue({ aborted: false });
    render(
      <DataChanges>
        <div />
      </DataChanges>
    );
  });

  it('requests a drain after a successful sync', async () => {
    await runSyncTick();

    expect(mockRequestDrain).toHaveBeenCalledTimes(1);
  });

  it('does not request a drain when the sync fails', async () => {
    mockDoDataChanges.mockRejectedValue(new Error('offline'));

    await runSyncTick();

    expect(mockRequestDrain).not.toHaveBeenCalled();
    expect(mockLogError).toHaveBeenCalled();
  });

  it('finishes the sync while the drain is still uploading', async () => {
    // A drain that never ends: the tick would hang if DataChanges waited on it.
    mockRequestDrain.mockImplementation(() => new Promise(() => undefined));

    await runSyncTick();

    expect(mockRequestDrain).toHaveBeenCalledTimes(1);
    // The sanity checks after the drain request still ran.
    expect(mockCheckAllProjects).toHaveBeenCalled();
  });
});
