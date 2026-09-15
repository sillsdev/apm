import { act, renderHook } from '@testing-library/react';
import { navigationCancelled, useMyNavigate } from './useMyNavigate';
import { describe, it, expect, jest, beforeEach } from '@jest/globals'

const mockNavigate = jest.fn();
const mockCheckHome = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('./useHome', () => ({
  useHome: () => ({ checkHome: mockCheckHome }),
}));

describe('useMyNavigate', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockCheckHome.mockClear();
  });

  it('navigates to goTo with options', () => {
    const { result } = renderHook(() => useMyNavigate());

    act(() => result.current('/team', { replace: true }));

    expect(mockCheckHome).toHaveBeenCalledWith('/team');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/team', { replace: true });
  });

  it('ignores a repeat navigation to the current goTo', () => {
    const { result } = renderHook(() => useMyNavigate());

    act(() => result.current('/team'));
    act(() => result.current('/team'));

    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });

  it('clears goTo when navigation is cancelled so a retry navigates again', () => {
    const { result } = renderHook(() => useMyNavigate());

    act(() => result.current('/team'));
    act(() => navigationCancelled());
    act(() => result.current('/team'));

    expect(mockNavigate).toHaveBeenCalledTimes(2);
    expect(mockNavigate).toHaveBeenLastCalledWith('/team', undefined);
  });

  it('does not navigate when cancelled with no pending goTo', () => {
    renderHook(() => useMyNavigate());

    act(() => navigationCancelled());

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('stops listening for cancel after unmount', () => {
    const { result, unmount } = renderHook(() => useMyNavigate());

    act(() => result.current('/team'));
    unmount();

    expect(() => act(() => navigationCancelled())).not.toThrow();
    expect(mockNavigate).toHaveBeenCalledTimes(1);
  });
});
