/**
 * TT-7720: Network error status must be cleared when AmIOnline succeeds,
 * including when `connected` is already true (stale ORBIT_RETRY after offline
 * save → reconnect → Pending Retry without a connected false→true edge).
 */
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import Axios from 'axios';
import { RESET_ORBIT_ERROR } from '../store/orbit/types';

jest.mock('axios');

jest.mock('../../api-variable', () => ({
  API_CONFIG: { host: 'https://api.test', snagId: '' },
  OrbitNetworkErrorRetries: 5,
}));

jest.mock('@bugsnag/js', () => ({
  resumeSession: jest.fn(),
  pauseSession: jest.fn(),
}));

const mockOrbitReset = jest.fn(async () => undefined);
jest.mock('../crud/orbitReset', () => ({
  orbitReset: (...args: unknown[]) => mockOrbitReset(...(args as [])),
}));

jest.mock('../store', () => ({
  resetOrbitError: () => ({ type: 'RESET_ORBIT_ERROR' }),
}));

jest.mock('../utils', () => {
  const { LocalKey } =
    jest.requireActual<typeof import('./localUserKey')>('./localUserKey');
  return { LocalKey };
});

const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  useDispatch: () => mockDispatch,
}));

const globals: Record<string, unknown> = {
  connected: true,
  offline: false,
  orbitRetries: 5,
  coordinator: {
    getSource: () => ({ requestQueue: { empty: true } }),
  },
};
const setConnected = jest.fn((v: boolean) => {
  globals.connected = v;
});
const setOrbitRetries = jest.fn((v: number) => {
  globals.orbitRetries = v;
});

jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    if (key === 'connected') return [globals.connected, setConnected];
    if (key === 'orbitRetries') return [globals.orbitRetries, setOrbitRetries];
    if (key === 'coordinator') return [globals.coordinator, jest.fn()];
    return [globals[key], jest.fn()];
  },
  useGetGlobal: () => (key: string) => globals[key],
}));

const mockedAxios = Axios as jest.Mocked<typeof Axios>;

describe('useCheckOnline (TT-7720)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    globals.connected = true;
    globals.offline = false;
    globals.orbitRetries = 5;
    mockedAxios.get.mockResolvedValue({ data: {} } as never);
  });

  it('clears orbit error status when already connected without queue.retry', async () => {
    globals.orbitRetries = 2;
    const { useCheckOnline } =
      require('./useCheckOnline') as typeof import('./useCheckOnline');

    const { result } = renderHook(() => useCheckOnline('TT-7720'));

    await act(async () => {
      await new Promise<void>((resolve) => {
        result.current(() => resolve(), true);
      });
    });

    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.test/api/AmIOnline/',
      expect.objectContaining({ timeout: 10000 })
    );
    expect(mockDispatch).toHaveBeenCalledWith({ type: RESET_ORBIT_ERROR });
    expect(setOrbitRetries).toHaveBeenCalledWith(5);
    // Must not retry the Orbit queue while already online — that re-fires
    // non-network failures (TT-7720 follow-up: passagestatechanges 403 → 500).
    expect(mockOrbitReset).not.toHaveBeenCalled();
  });

  it('runs full orbitReset and sets connected when coming back online', async () => {
    globals.connected = false;
    const { useCheckOnline } =
      require('./useCheckOnline') as typeof import('./useCheckOnline');

    const { result } = renderHook(() => useCheckOnline('TT-7720'));

    await act(async () => {
      await new Promise<void>((resolve) => {
        result.current(() => resolve(), true);
      });
    });

    // Cleared before and after queue.retry (retry can re-set ORBIT_RETRY).
    expect(mockDispatch).toHaveBeenCalledWith({ type: RESET_ORBIT_ERROR });
    expect(
      mockDispatch.mock.calls.filter(
        (c) => (c[0] as { type?: string })?.type === RESET_ORBIT_ERROR
      ).length
    ).toBeGreaterThanOrEqual(2);
    expect(mockOrbitReset).toHaveBeenCalled();
    expect(setConnected).toHaveBeenCalledWith(true);
  });
});
