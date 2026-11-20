import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { BlobStatus, useFetchMediaBlob } from '../crud/useFetchMediaBlob';
import { audioManager, type AudioHandle } from './audioManager';
import type { TimeRange } from '../control/formatTime';

export interface UseMiniAudioProps {
  /** Media file to play. Changing it stops playback and resets the clip. */
  mediaId: string;
  /** Play only this part of the media; an `end` of 0 plays to the end. */
  clip?: TimeRange;
  onFinish?: () => void;
}

export interface MiniAudio {
  playing: boolean;
  /** True from the first play request until the media has been fetched. */
  loading: boolean;
  /** Playhead, in seconds from the clip start. */
  position: number;
  /** Clip length in seconds, or 0 while it is not known yet. */
  length: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Move the playhead to `position` seconds from the clip start. */
  seek: (position: number) => void;
}

/**
 * Plays one media file, or a clip of one, through a plain HTMLAudioElement
 * registered with {@link audioManager}, so starting it pauses whatever else is
 * playing and vice versa.
 *
 * Nothing is fetched until playback is first requested, and the media is never
 * decoded, so an unplayed clip costs no network and no memory. Playback state is
 * owned here; callers only ask to play or pause.
 */
export function useMiniAudio({
  mediaId,
  clip,
  onFinish,
}: UseMiniAudioProps): MiniAudio {
  const [blobState, fetchBlob] = useFetchMediaBlob();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // Play was requested before the media was ready; play once it is.
  const [playRequested, setPlayRequested] = useState(false);
  const elRef = useRef<HTMLAudioElement | null>(null);
  const handleRef = useRef<AudioHandle | null>(null);

  // reset if media id changed
  const [prevMediaId, setPrevMediaId] = useState(mediaId);
  if (prevMediaId !== mediaId) {
    setPrevMediaId(mediaId);
    setPlayRequested(false);
    setLoading(false);
    setTime(0);
    setDuration(0);
  }

  const start = clip?.start ?? 0;
  const end = clip?.end ?? 0;
  const notifyFinish = useEffectEvent(() => onFinish?.());
  const isPlayRequested = useEffectEvent(() => playRequested);

  const requestPlay = useCallback(() => {
    if (!mediaId) return;
    const handle = handleRef.current;
    if (handle) {
      audioManager.play(handle);
      return;
    }
    setPlayRequested(true);
    setLoading(true);
    fetchBlob(mediaId);
  }, [mediaId, fetchBlob]);

  // Build the element once this media's blob is fetched. A new clip rebuilds it
  // from the same blob (no refetch), stopped at the new clip start.
  useEffect(() => {
    if (blobState.id !== mediaId) return;
    if (blobState.blobStat === BlobStatus.ERROR) {
      setPlayRequested(false);
      setLoading(false);
      return;
    }
    if (blobState.blobStat !== BlobStatus.FETCHED) return;

    const url = URL.createObjectURL(blobState.blob);
    const el = new Audio(url);
    el.preload = 'auto';
    elRef.current = el;

    const rewind = () => {
      el.currentTime = start;
      setTime(start);
    };
    const handle: AudioHandle = {
      play: () => {
        const t = el.currentTime;
        const stopAt = end > 0 ? end : el.duration || 0;
        if (t < start || (stopAt > 0 && t >= stopAt)) rewind();
        // Browsers can refuse play() (e.g. autoplay without a user gesture).
        Promise.resolve(el.play()).catch(() => {
          setPlaying(false);
          audioManager.release(handle);
        });
      },
      pause: () => el.pause(),
      stop: () => {
        el.pause();
        rewind();
      },
    };
    handleRef.current = handle;

    // WebM from MediaRecorder reports an Infinity duration until the whole
    // file has been read; seeking far past the end makes the browser work it
    // out, after which the playhead is put back.
    let probingDuration = false;
    const onDuration = () => {
      if (el.duration === Infinity) {
        if (!probingDuration) {
          probingDuration = true;
          el.currentTime = Number.MAX_SAFE_INTEGER;
        }
        return;
      }
      if (Number.isFinite(el.duration)) {
        setDuration(el.duration);
        if (probingDuration) {
          probingDuration = false;
          rewind();
        }
      }
    };
    const finish = () => {
      el.pause();
      rewind();
      audioManager.release(handle);
      notifyFinish();
    };
    const onTime = () => {
      if (probingDuration) return;
      const t = el.currentTime;
      if (end > 0 && t >= end) finish();
      else setTime(t);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => {
      setPlaying(false);
      audioManager.release(handle);
    };
    el.addEventListener('loadedmetadata', onDuration);
    el.addEventListener('durationchange', onDuration);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', finish);

    rewind();
    setLoading(false);
    if (isPlayRequested()) {
      setPlayRequested(false);
      audioManager.play(handle);
    }

    return () => {
      el.pause();
      audioManager.release(handle);
      el.removeEventListener('loadedmetadata', onDuration);
      el.removeEventListener('durationchange', onDuration);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', finish);
      el.removeAttribute('src');
      URL.revokeObjectURL(url);
      if (elRef.current === el) elRef.current = null;
      if (handleRef.current === handle) handleRef.current = null;
      setPlaying(false);
    };
  }, [blobState, mediaId, start, end]);

  const pause = useCallback(() => {
    const handle = handleRef.current;
    if (handle && !elRef.current?.paused) handle.pause?.();
    setPlayRequested(false);
  }, []);

  const toggle = useCallback(() => {
    if (playing || playRequested) pause();
    else requestPlay();
  }, [playing, playRequested, pause, requestPlay]);

  const seek = useCallback(
    (position: number) => {
      const el = elRef.current;
      const t = start + Math.max(0, position);
      if (el) el.currentTime = t;
      setTime(t);
    },
    [start]
  );

  const stopAt = end > 0 ? end : duration;
  return {
    playing,
    loading,
    position: Math.max(0, time - start),
    length: Math.max(0, stopAt - start),
    play: requestPlay,
    pause,
    toggle,
    seek,
  };
}

export default useMiniAudio;
