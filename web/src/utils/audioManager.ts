import { useSyncExternalStore } from 'react';

/**
 * A registrable audio source. Every source can `stop` (halt and rewind to the
 * start). `pause` (halt but keep position, for resuming) is optional.
 */
export type AudioHandle = {
  play: () => void | Promise<void>;
  pause?: () => void;
  stop: () => void;
};

// The source of truth for what is playing right now, if anything.
let active: AudioHandle | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const isPlaying = () => active !== null;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const audioManager = {
  play(handle: AudioHandle) {
    const prev = active;
    active = handle; // reassign first so a prev callback's release() is a no-op
    // Preempt the previous: pause it if it can resume, otherwise stop (rewind) it.
    if (prev && prev !== handle) (prev.pause ?? prev.stop)();
    handle.play();
    emit();
  },

  release(handle: AudioHandle) {
    if (active === handle) {
      active = null;
      emit();
    }
  },

  pause() {
    const prev = active;
    active = null;
    if (prev) (prev.pause ?? prev.stop)();
    if (prev) emit();
  },

  stop() {
    const prev = active;
    active = null;
    prev?.stop();
    if (prev) emit();
  },
};

export function useIsAudioPlaying() {
  return useSyncExternalStore(subscribe, isPlaying);
}
