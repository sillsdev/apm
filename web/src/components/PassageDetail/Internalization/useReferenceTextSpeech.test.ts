import { act, renderHook } from '@testing-library/react';
import { ReferenceText } from '../../../business/referenceText/referenceText';
import type { SpeakOutcome } from '../../../business/referenceText/speakReferenceText';

const mockCtx = {
  playing: false,
  itemPlaying: false,
  commentPlaying: false,
  oldVernacularPlaying: false,
  setPlaying: jest.fn(),
  setItemPlaying: jest.fn(),
  setCommentPlaying: jest.fn(),
  handleOldVernacularPlayEnd: jest.fn(),
};
jest.mock('../../../context/usePassageDetailContext', () => ({
  __esModule: true,
  default: () => mockCtx,
}));

let mockFinish: (outcome: SpeakOutcome) => void;
let mockProgress: ((percent: number) => void) | undefined;
const mockStop = jest.fn(() => mockFinish('stopped'));
jest.mock('../../../business/referenceText/speakReferenceText', () => ({
  speakReferenceText: jest.fn(
    (_r: unknown, _t: string, onProgress?: (p: number) => void) => {
      mockProgress = onProgress;
      return {
        done: new Promise<SpeakOutcome>((resolve) => (mockFinish = resolve)),
        stop: mockStop,
      };
    }
  ),
}));

import { useReferenceTextSpeech } from './useReferenceTextSpeech';
import { speakReferenceText } from '../../../business/referenceText/speakReferenceText';

const bsb = { id: 'BSB', language: 'eng' } as ReferenceText;

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockCtx, {
    playing: false,
    itemPlaying: false,
    commentPlaying: false,
    oldVernacularPlaying: false,
  });
});

describe('useReferenceTextSpeech', () => {
  it('speaks a role, shows its progress, and resolves how it ended', async () => {
    const { result } = renderHook(() => useReferenceTextSpeech());
    let outcome: Promise<SpeakOutcome | undefined>;
    act(() => {
      outcome = result.current.toggle('primary', bsb, 'text');
    });
    expect(speakReferenceText).toHaveBeenCalledWith(
      bsb,
      'text',
      expect.any(Function)
    );
    expect(result.current.speaking).toBe('primary');
    act(() => mockProgress?.(40));
    expect(result.current.progress).toBe(40);
    await act(async () => {
      mockFinish('ended');
      await expect(outcome).resolves.toBe('ended');
    });
    expect(result.current.speaking).toBeUndefined();
    expect(result.current.progress).toBe(0);
  });

  it('stops the passage playback in progress when speaking starts', () => {
    mockCtx.itemPlaying = true;
    mockCtx.oldVernacularPlaying = true;
    const { result } = renderHook(() => useReferenceTextSpeech());
    act(() => {
      void result.current.toggle('primary', bsb, 'text');
    });
    expect(mockCtx.setItemPlaying).toHaveBeenCalledWith(false);
    expect(mockCtx.setPlaying).toHaveBeenCalledWith(false);
    expect(mockCtx.setCommentPlaying).toHaveBeenCalledWith(false);
    expect(mockCtx.handleOldVernacularPlayEnd).toHaveBeenCalled();
  });

  it('stops when the speaking role is toggled again', async () => {
    const { result } = renderHook(() => useReferenceTextSpeech());
    act(() => {
      void result.current.toggle('primary', bsb, 'text');
    });
    await act(async () => {
      await result.current.toggle('primary', bsb, 'text');
    });
    expect(mockStop).toHaveBeenCalled();
    expect(speakReferenceText).toHaveBeenCalledTimes(1);
    expect(result.current.speaking).toBeUndefined();
  });

  it('stops when other passage audio starts', () => {
    const { result, rerender } = renderHook(() => useReferenceTextSpeech());
    act(() => {
      void result.current.toggle('primary', bsb, 'text');
    });
    mockCtx.itemPlaying = true;
    rerender();
    expect(mockStop).toHaveBeenCalled();
  });

  it('stops when unmounted', () => {
    const { result, unmount } = renderHook(() => useReferenceTextSpeech());
    act(() => {
      void result.current.toggle('primary', bsb, 'text');
    });
    unmount();
    expect(mockStop).toHaveBeenCalled();
  });
});
