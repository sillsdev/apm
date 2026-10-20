import { act, renderHook } from '@testing-library/react';
import {
  AI_PROGRESS_MAX_FRACTION,
  aiProgressAt,
  useAiProgress,
} from './useAiProgress';

describe('aiProgressAt', () => {
  it('counts down while within the estimate', () => {
    expect(aiProgressAt(100, 25)).toEqual({
      status: 'estimating',
      elapsedSec: 25,
      remainingSec: 75,
      fraction: 0.25,
    });
  });

  it('stops the bar short of full', () => {
    const progress = aiProgressAt(100, 99);
    expect(progress.status === 'estimating' && progress.fraction).toBe(
      AI_PROGRESS_MAX_FRACTION
    );
  });

  it('is still estimating exactly at the estimate', () => {
    expect(aiProgressAt(100, 100).status).toBe('estimating');
  });

  it('runs over once past the estimate', () => {
    expect(aiProgressAt(100, 101)).toEqual({
      status: 'overrun',
      elapsedSec: 101,
    });
  });

  it('has nothing to count down without an estimate', () => {
    expect(aiProgressAt(undefined, 5)).toEqual({
      status: 'unknown',
      elapsedSec: 5,
    });
    expect(aiProgressAt(0, 5).status).toBe('unknown');
  });
});

describe('useAiProgress', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('advances each second and flips to overrun', () => {
    const startedAt = Date.now();
    const { result } = renderHook(() => useAiProgress(3, startedAt));
    expect(result.current.status).toBe('estimating');
    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(result.current).toEqual({ status: 'overrun', elapsedSec: 4 });
  });
});
