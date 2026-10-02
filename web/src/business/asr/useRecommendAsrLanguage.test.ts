import { renderHook, act } from '@testing-library/react';
import { axiosGet } from '../../utils/axios';
import { useRecommendAsrLanguage } from './useRecommendAsrLanguage';

jest.mock('../../utils/axios', () => ({ axiosGet: jest.fn() }));
jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn(() => [undefined, jest.fn()]),
}));
jest.mock('../../utils/logErrorService', () => ({
  __esModule: true,
  default: jest.fn(),
  Severity: { error: 'error' },
}));
jest.mock('../../context/TokenProvider', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { TokenContext: React.createContext(undefined) };
});

const mockAxiosGet = axiosGet as jest.Mock;

describe('useRecommendAsrLanguage polling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockAxiosGet.mockReset();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('stops polling once results arrive', async () => {
    mockAxiosGet
      .mockResolvedValueOnce('task-1') // initial fetch -> task id
      .mockResolvedValueOnce({}) // poll #1: still pending
      .mockResolvedValueOnce({
        recommendations: [{ iso: 'lgg', name: 'Lugbara', methods: ['mms'] }],
      }); // poll #2: done

    const { result } = renderHook(() => useRecommendAsrLanguage());

    await act(async () => {
      await result.current.fetchRecommendations('luo');
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000); // poll #1 (pending)
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000); // poll #2 (data -> stop)
    });

    expect(result.current.suggestions).toHaveLength(1);

    const callsWhenDone = mockAxiosGet.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(20000); // many more ticks
    });
    // No further polling after results are processed.
    expect(mockAxiosGet.mock.calls.length).toBe(callsWhenDone);
  });

  it('does not start an orphaned interval when the fetch resolves after unmount', async () => {
    let resolveFetch: (v: unknown) => void = () => undefined;
    mockAxiosGet.mockImplementationOnce(
      () => new Promise((res) => (resolveFetch = res))
    );

    const { result, unmount } = renderHook(() => useRecommendAsrLanguage());
    act(() => {
      void result.current.fetchRecommendations('luo');
    });

    unmount(); // hook torn down while the initial request is still in flight

    await act(async () => {
      resolveFetch('task-1'); // late resolve must not schedule polling
      await jest.advanceTimersByTimeAsync(0); // drain the fetch continuation
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10000);
    });

    // Only the initial fetch ran; no asrsisters/{taskId} poll was scheduled.
    expect(mockAxiosGet).toHaveBeenCalledTimes(1);
  });
});
