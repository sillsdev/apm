import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';

// Answers keyed by language; a function gives control of when it settles.
let mockAnswers: Record<string, () => Promise<boolean>> = {};
// Answers already known this session, keyed by language.
let mockCached: Record<string, boolean> = {};
const mockLogError = jest.fn();

jest.mock('./asrLanguages', () => ({
  needsSisterLanguage: (bcp47: string) => mockAnswers[bcp47](),
  cachedNeedsSisterLanguage: (bcp47: string) => mockCached[bcp47],
}));

jest.mock('../../context/TokenProvider', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    TokenContext: React.createContext({ state: { accessToken: 'tok' } }),
  };
});

jest.mock('../../context/useGlobal', () => ({
  useGlobal: () => [undefined],
}));

jest.mock('../../utils/logErrorService', () => ({
  Severity: { error: 1 },
  logError: (...args: unknown[]) => mockLogError(...args),
}));

import { useNeedsSisterLanguage } from './useNeedsSisterLanguage';

describe('useNeedsSisterLanguage', () => {
  beforeEach(() => {
    mockLogError.mockReset();
    mockCached = {};
    mockAnswers = {
      tlh: async () => true,
      en: async () => false,
    };
  });

  it('is undefined until the service answers, then gives the answer', async () => {
    const { result } = renderHook(() => useNeedsSisterLanguage('tlh'));
    expect(result.current.needsSister).toBeUndefined();
    await waitFor(() => expect(result.current.needsSister).toBe(true));
  });

  it('ignores an answer for a language that has since changed', async () => {
    let settleOld: (v: boolean) => void = () => undefined;
    mockAnswers.old = () =>
      new Promise<boolean>((resolve) => {
        settleOld = resolve;
      });
    const { result, rerender } = renderHook(
      ({ bcp47 }) => useNeedsSisterLanguage(bcp47),
      { initialProps: { bcp47: 'old' } }
    );
    rerender({ bcp47: 'en' });
    await waitFor(() => expect(result.current.needsSister).toBe(false));
    settleOld(true);
    await Promise.resolve();
    expect(result.current.needsSister).toBe(false);
  });

  it('logs a failure and reports it once', async () => {
    mockAnswers.tlh = async () => {
      throw new Error('aero down');
    };
    const onFailed = jest.fn();
    const { result } = renderHook(() =>
      useNeedsSisterLanguage('tlh', { onFailed })
    );
    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.needsSister).toBeUndefined();
    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(onFailed).toHaveBeenCalledTimes(1);
  });

  it('answers at once, without asking, for a language already checked', () => {
    const answer = jest.fn(async () => false);
    mockAnswers.tlh = answer;
    mockCached.tlh = true;
    const { result } = renderHook(() => useNeedsSisterLanguage('tlh'));
    expect(result.current.needsSister).toBe(true);
    expect(answer).not.toHaveBeenCalled();
  });

  it('skips the check when disabled', () => {
    const answer = jest.fn(async () => true);
    mockAnswers.tlh = answer;
    renderHook(() => useNeedsSisterLanguage('tlh', { enabled: false }));
    expect(answer).not.toHaveBeenCalled();
  });
});
