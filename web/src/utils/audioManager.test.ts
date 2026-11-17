import { act, renderHook } from '@testing-library/react';
import {
  audioManager,
  useIsAudioPlaying,
  type AudioHandle,
} from './audioManager';

const pausable = () => ({
  play: jest.fn(),
  pause: jest.fn(),
  stop: jest.fn(),
});

const stopOnly = (): AudioHandle & { play: jest.Mock; stop: jest.Mock } => ({
  play: jest.fn(),
  stop: jest.fn(),
});

describe('audioManager', () => {
  // The active handle is module state, so clear it between tests.
  afterEach(() => {
    audioManager.stop();
  });

  describe('play', () => {
    it('plays the audio', () => {
      const a = pausable();
      audioManager.play(a);
      expect(a.play).toHaveBeenCalledTimes(1);
    });

    it('pauses the previous handle when it can pause', () => {
      const a = pausable();
      const b = pausable();
      audioManager.play(a);
      audioManager.play(b);
      expect(a.pause).toHaveBeenCalledTimes(1);
      expect(a.stop).not.toHaveBeenCalled();
      expect(b.play).toHaveBeenCalledTimes(1);
    });

    it('stops the previous handle when it cannot pause', () => {
      const a = stopOnly();
      audioManager.play(a);
      audioManager.play(pausable());
      expect(a.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('pause', () => {
    it('pauses the active handle when it can pause', () => {
      const a = pausable();
      audioManager.play(a);
      audioManager.pause();
      expect(a.pause).toHaveBeenCalledTimes(1);
      expect(a.stop).not.toHaveBeenCalled();
    });

    it('stops the active handle when it cannot pause', () => {
      const a = stopOnly();
      audioManager.play(a);
      audioManager.pause();
      expect(a.stop).toHaveBeenCalledTimes(1);
    });
  });

  describe('stop', () => {
    it('stops the active handle even when it can pause', () => {
      const a = pausable();
      audioManager.play(a);
      audioManager.stop();
      expect(a.stop).toHaveBeenCalledTimes(1);
      expect(a.pause).not.toHaveBeenCalled();
    });

    it('does nothing when no handle is active', () => {
      expect(() => audioManager.stop()).not.toThrow();
    });
  });

  describe('useIsAudioPlaying', () => {
    it('tracks whether a handle is active', () => {
      const a = pausable();
      const { result } = renderHook(() => useIsAudioPlaying());
      expect(result.current).toBe(false);

      act(() => audioManager.play(a));
      expect(result.current).toBe(true);

      act(() => audioManager.pause());
      expect(result.current).toBe(false);

      act(() => audioManager.play(a));
      expect(result.current).toBe(true);

      act(() => audioManager.stop());
      expect(result.current).toBe(false);
    });
  });
});
