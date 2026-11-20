import { act, renderHook } from '@testing-library/react';
import { audioManager } from './audioManager';
import { useMiniAudio } from './useMiniAudio';
import type { TimeRange } from '../control/formatTime';

// TODO red-green test

// The blob fetch is the network boundary: tests decide when (and whether) it
// completes, and see which media ids were requested.
const mockFetchBlob = jest.fn();
let mockBlobState = { id: '', blobStat: 0, blob: new Blob() };
jest.mock('../crud/useFetchMediaBlob', () => ({
  BlobStatus: { IDLE: 0, PENDING: 1, RESET: 2, FETCHED: 3, ERROR: 4 },
  useFetchMediaBlob: () => [mockBlobState, mockFetchBlob],
}));
const FETCHED = 3;

// jsdom has no media playback: play/pause just flip `paused` and fire the
// events a browser would.
let audios: HTMLAudioElement[] = [];
const fire = (el: HTMLMediaElement, type: string) =>
  act(() => {
    el.dispatchEvent(new Event(type));
  });
const setDuration = (el: HTMLMediaElement, duration: number) => {
  Object.defineProperty(el, 'duration', {
    configurable: true,
    get: () => duration,
  });
  fire(el, 'durationchange');
};
const playTo = (el: HTMLMediaElement, time: number) => {
  el.currentTime = time;
  fire(el, 'timeupdate');
};

beforeAll(() => {
  URL.createObjectURL = jest.fn(() => 'blob:clip');
  URL.revokeObjectURL = jest.fn();
});

beforeEach(() => {
  audios = [];
  mockFetchBlob.mockReset();
  mockBlobState = { id: '', blobStat: 0, blob: new Blob() };
  jest.spyOn(window, 'Audio').mockImplementation((src?: string) => {
    const el = document.createElement('audio');
    if (src) el.src = src;
    let paused = true;
    Object.defineProperty(el, 'paused', { get: () => paused });
    el.play = jest.fn(() => {
      paused = false;
      el.dispatchEvent(new Event('play'));
      return Promise.resolve();
    });
    el.pause = jest.fn(() => {
      if (paused) return;
      paused = true;
      el.dispatchEvent(new Event('pause'));
    });
    audios.push(el);
    return el;
  });
});

afterEach(() => {
  audioManager.stop();
  jest.restoreAllMocks();
});

type Props = { mediaId: string; clip?: TimeRange };
const renderPlayer = (props: Props, onFinish = jest.fn()) =>
  renderHook((p: Props) => useMiniAudio({ ...p, onFinish }), {
    initialProps: props,
  });

/** Completes the pending blob fetch for `id`. */
const deliver = (
  rerender: (p: Props) => void,
  props: Props,
  id = props.mediaId
) => {
  mockBlobState = { id, blobStat: FETCHED, blob: new Blob(['x']) };
  rerender({ ...props });
};

/** Renders a clip, presses play and completes the fetch: it is playing. */
const renderPlaying = (props: Props, onFinish = jest.fn()) => {
  const player = renderPlayer(props, onFinish);
  act(() => player.result.current.play());
  deliver(player.rerender, props);
  return player;
};

describe('useMiniAudio', () => {
  it('fetches nothing until play is requested', () => {
    renderPlayer({ mediaId: 'm1' });

    expect(mockFetchBlob).not.toHaveBeenCalled();
    expect(audios).toHaveLength(0);
  });

  it('fetches on the first play, shows loading, then plays once fetched', () => {
    const props = { mediaId: 'm1' };
    const { result, rerender } = renderPlayer(props);

    act(() => result.current.play());
    expect(mockFetchBlob).toHaveBeenCalledWith('m1');
    expect(result.current.loading).toBe(true);

    deliver(rerender, props);

    expect(result.current.loading).toBe(false);
    expect(audios).toHaveLength(1);
    expect(audios[0].play).toHaveBeenCalled();
    expect(result.current.playing).toBe(true);
  });

  it('starting one clip pauses another (audioManager)', () => {
    const a = renderPlaying({ mediaId: 'a' });
    const elA = audios[0];
    expect(a.result.current.playing).toBe(true);

    const b = renderPlaying({ mediaId: 'b' });

    expect(elA.pause).toHaveBeenCalled();
    expect(a.result.current.playing).toBe(false);
    expect(b.result.current.playing).toBe(true);
  });

  it('starts at the clip start and stops (rewinding) at its end', () => {
    const onFinish = jest.fn();
    const props = { mediaId: 'm1', clip: { start: 10, end: 20 } };
    const { result, rerender } = renderPlayer(props, onFinish);
    act(() => result.current.play());
    deliver(rerender, props);
    const el = audios[0];
    expect(el.currentTime).toBe(10);

    playTo(el, 15);
    expect(result.current.position).toBe(5);
    expect(result.current.length).toBe(10);
    expect(onFinish).not.toHaveBeenCalled();

    playTo(el, 20.1);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(result.current.playing).toBe(false);
    expect(el.currentTime).toBe(10);
  });

  // e.g. a resource's segment edited while its card stays mounted.
  it('a new clip rebuilds the element from the same blob, stopped at the new start', () => {
    const onFinish = jest.fn();
    const props: Props = { mediaId: 'm1' };
    const { result, rerender } = renderPlayer(props, onFinish);
    act(() => result.current.play());
    deliver(rerender, props);
    setDuration(audios[0], 300);
    expect(result.current.length).toBe(300);
    expect(result.current.playing).toBe(true);

    rerender({ mediaId: 'm1', clip: { start: 10, end: 20 } });
    expect(audios).toHaveLength(2);
    expect(mockFetchBlob).toHaveBeenCalledTimes(1);
    expect(audios[0].pause).toHaveBeenCalled();
    expect(result.current.playing).toBe(false);
    expect(result.current.length).toBe(10);
    const el = audios[1];
    expect(el.currentTime).toBe(10);

    act(() => result.current.play());
    playTo(el, 20.1);
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(el.currentTime).toBe(10);
  });

  it('pause keeps the position and play resumes from it', () => {
    const { result } = renderPlaying({ mediaId: 'm1' });
    const el = audios[0];
    setDuration(el, 60);
    playTo(el, 12);

    act(() => result.current.toggle());
    expect(result.current.playing).toBe(false);
    act(() => result.current.toggle());

    expect(result.current.playing).toBe(true);
    expect(el.currentTime).toBe(12);
  });

  it('seek moves the playhead relative to the clip start', () => {
    const props = { mediaId: 'm1', clip: { start: 5, end: 50 } };
    const { result, rerender } = renderPlayer(props);
    act(() => result.current.play());
    deliver(rerender, props);

    act(() => result.current.seek(7));

    expect(audios[0].currentTime).toBe(12);
    expect(result.current.position).toBe(7);
  });

  it('a new media id drops the old element and starts over', () => {
    const { result, rerender } = renderPlaying({ mediaId: 'm1' });
    const old = audios[0];
    mockFetchBlob.mockClear();

    rerender({ mediaId: 'm2' });

    expect(old.pause).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
    expect(result.current.playing).toBe(false);
    expect(result.current.loading).toBe(false);
    // Nothing is fetched for the new media until it is played.
    expect(mockFetchBlob).not.toHaveBeenCalled();
    act(() => result.current.play());
    expect(mockFetchBlob).toHaveBeenCalledWith('m2');
  });

  it('releases audioManager when unmounted mid-play', () => {
    const { unmount } = renderPlaying({ mediaId: 'm1' });

    unmount();

    expect(audios[0].pause).toHaveBeenCalled();
  });
});
