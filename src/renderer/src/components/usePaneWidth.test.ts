jest.mock('react', () => {
  const actual = jest.requireActual<typeof import('react')>('react');
  return {
    ...actual,
    useContext: jest.fn(),
  };
});

jest.mock('@mui/material', () => ({
  /** Avoid timers: listener must invoke setDimensions synchronously in tests. */
  debounce: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

/** Stub context token — importing the real module pulls a large graph (router, store, …). */
jest.mock('../context/PassageDetailContext', () => ({
  PassageDetailContext: {},
}));

import { useContext } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';

import { usePaneWidth } from './usePaneWidth';

const setDiscussionSize = jest.fn();

/** Mutable context payload so rerender sees updated flags/sizes (same pattern as keyed global maps in hook tests). */
const passageDetailCtx: {
  state: {
    discussionSize: { width: number; height: number };
    discussOpen: boolean;
    setDiscussionSize: jest.Mock;
  };
} = {
  state: {
    discussionSize: { width: 300, height: 630 },
    discussOpen: false,
    setDiscussionSize,
  },
};

const setWindowSize = (innerWidth: number, innerHeight: number) => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: innerWidth,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    writable: true,
    value: innerHeight,
  });
};

describe('usePaneWidth', () => {
  beforeEach(() => {
    setDiscussionSize.mockClear();
    setWindowSize(1000, 800);
    passageDetailCtx.state = {
      discussionSize: { width: 300, height: 800 - 170 },
      discussOpen: false,
      setDiscussionSize,
    };
    (useContext as unknown as jest.Mock).mockImplementation(
      () => passageDetailCtx
    );
  });

  afterEach(() => {
    (useContext as unknown as jest.Mock).mockClear();
  });

  it('exposes width from window after mount effect runs', async () => {
    const { result } = renderHook(() => usePaneWidth());

    await waitFor(() => {
      expect(result.current.width).toBe(1000);
    });
  });

  it('sets paneWidth equal to width when discussion is closed', async () => {
    const { result } = renderHook(() => usePaneWidth());

    await waitFor(() => {
      expect(result.current.paneWidth).toBe(1000);
    });
    expect(result.current.paneWidth).toBe(result.current.width);
  });

  it('subtracts discussion width when discussion is open', async () => {
    const { result, rerender } = renderHook(() => usePaneWidth());

    await waitFor(() => {
      expect(result.current.width).toBe(1000);
    });

    passageDetailCtx.state.discussOpen = true;
    rerender();

    await waitFor(() => {
      expect(result.current.paneWidth).toBe(700);
    });
  });

  it('clamps paneWidth to 0 when discussion wider than window', async () => {
    passageDetailCtx.state.discussionSize = { width: 1200, height: 630 };
    passageDetailCtx.state.discussOpen = true;
    const { result } = renderHook(() => usePaneWidth());

    await waitFor(() => {
      expect(result.current.paneWidth).toBe(0);
    });
  });

  it('updates paneWidth when discussionSize.width changes', async () => {
    const { result, rerender } = renderHook(() => usePaneWidth());

    await waitFor(() => {
      expect(result.current.width).toBe(1000);
    });

    passageDetailCtx.state.discussOpen = true;
    passageDetailCtx.state.discussionSize = { width: 300, height: 630 };
    rerender();
    await waitFor(() => {
      expect(result.current.paneWidth).toBe(700);
    });

    passageDetailCtx.state.discussionSize = { width: 400, height: 630 };
    rerender();
    await waitFor(() => {
      expect(result.current.paneWidth).toBe(600);
    });
  });

  it('caps discussion width at 450 when syncing dimensions on mount', () => {
    passageDetailCtx.state.discussionSize = { width: 600, height: 630 };
    renderHook(() => usePaneWidth());

    expect(setDiscussionSize).toHaveBeenCalledWith(
      expect.objectContaining({ width: 450 })
    );
  });

  it('calls setDiscussionSize when discussion height differs from innerHeight - 170', () => {
    passageDetailCtx.state.discussionSize = { width: 300, height: 100 };
    renderHook(() => usePaneWidth());

    expect(setDiscussionSize).toHaveBeenCalledWith({
      width: 300,
      height: 800 - 170,
    });
  });

  it('runs resize handler when window dispatches resize', async () => {
    const { result } = renderHook(() => usePaneWidth());

    await waitFor(() => {
      expect(result.current.width).toBe(1000);
    });

    await act(async () => {
      setWindowSize(1200, 800);
      window.dispatchEvent(new Event('resize'));
    });

    await waitFor(() => {
      expect(result.current.width).toBe(1200);
    });
  });
});
