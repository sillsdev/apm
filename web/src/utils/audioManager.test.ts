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

  describe('replace', () => {
    it('plays the new handle in place of the active one', () => {
      const pending = pausable();
      const ready = pausable();
      audioManager.play(pending);

      expect(audioManager.replace(pending, ready)).toBe(true);
      expect(ready.play).toHaveBeenCalledTimes(1);

      // `ready` is now the active one: pausing reaches it.
      audioManager.pause();
      expect(ready.pause).toHaveBeenCalledTimes(1);
    });

    // A caller passing a handle that is really playing must not end up with
    // two sources playing, one of them no longer tracked.
    it('preempts the old handle like any other play', () => {
      const playing = pausable();
      const next = pausable();
      audioManager.play(playing);

      audioManager.replace(playing, next);

      expect(playing.pause).toHaveBeenCalledTimes(1);
      expect(next.play).toHaveBeenCalledTimes(1);
    });

    it.each([
      ['paused', () => audioManager.pause()],
      ['stopped', () => audioManager.stop()],
      ['preempted', () => audioManager.play(pausable())],
    ])('does nothing once the old handle was %s', (_how, interrupt) => {
      const pending = pausable();
      const ready = pausable();
      audioManager.play(pending);
      interrupt();

      expect(audioManager.replace(pending, ready)).toBe(false);
      expect(ready.play).not.toHaveBeenCalled();
    });

    it('keeps reporting playing across the hand-over', () => {
      const { result } = renderHook(() => useIsAudioPlaying());
      const pending = pausable();
      act(() => audioManager.play(pending));
      act(() => {
        audioManager.replace(pending, pausable());
      });
      expect(result.current).toBe(true);
    });
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
