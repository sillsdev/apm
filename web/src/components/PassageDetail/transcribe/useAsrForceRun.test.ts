import { describe, expect, it } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import { useAsrForceRun } from './useAsrForceRun';
import type { IAsrState } from '../../../business/asr/asrState';

const base = {
  target: 'alphabet',
  language: { bcp47: 'en', languageName: 'English' },
  asrIso: 'eng',
  asrMethod: 'mms',
  dialect: undefined,
  selectRoman: false,
} as IAsrState;

describe('useAsrForceRun', () => {
  it('forces when closed settings differ from the open snapshot', () => {
    const { result } = renderHook(() => useAsrForceRun(base));

    act(() => result.current.snapshotAsrAtOpen());
    act(() =>
      result.current.applyForceFromClosedAsr({
        ...base,
        asrMethod: 'whisper',
      })
    );

    expect(result.current.forceAsr).toBe(true);
  });

  it('does not force when closed settings match the open snapshot', () => {
    const { result } = renderHook(() => useAsrForceRun(base));

    act(() => result.current.snapshotAsrAtOpen());
    act(() => result.current.applyForceFromClosedAsr({ ...base }));

    expect(result.current.forceAsr).toBe(false);
  });

  // TT-7856: closing the progress dialog clears force, but the running
  // task's result must still replace the earlier transcription.
  it('keeps replacing after force clears, until replace is cleared', () => {
    const { result } = renderHook(() => useAsrForceRun(base));

    act(() => result.current.snapshotAsrAtOpen());
    act(() =>
      result.current.applyForceFromClosedAsr({ ...base, asrMethod: 'whisper' })
    );
    act(() => result.current.clearForceAsr());

    expect(result.current.forceAsr).toBe(false);
    expect(result.current.replaceAsr).toBe(true);

    act(() => result.current.snapshotAsrAtOpen());
    act(() => result.current.applyForceFromClosedAsr({ ...base }));
    expect(result.current.replaceAsr).toBe(true);

    act(() => result.current.clearReplaceAsr());
    expect(result.current.replaceAsr).toBe(false);
  });
});
