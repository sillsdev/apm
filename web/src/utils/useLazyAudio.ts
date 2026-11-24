import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { BlobStatus, useFetchMediaBlob } from '../crud/useFetchMediaBlob';
import { useGlobal } from '../context/useGlobal';
import { useSnackBar } from '../hoc/SnackBar';
import { ISharedStrings } from '../model';
import { sharedSelector } from '../selector';
import { audioManager, type AudioHandle } from './audioManager';
import logError, { Severity } from './logErrorService';
import type { TimeRange } from '../control/formatTime';
import { LazyAudioStatus } from './lazyAudioStatus';

export interface UseLazyAudioProps {
  /** Media file to play. Changing it stops playback and resets the clip. */
  mediaId: string;
  /** Play only this part of the media; an `end` of 0 plays to the end. */
  clip?: TimeRange;
  onFinish?: () => void;
}

export interface LazyAudio {
  status: LazyAudioStatus;
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
export function useLazyAudio({
  mediaId,
  clip,
  onFinish,
}: UseLazyAudioProps): LazyAudio {
  const [blobState, fetchBlob] = useFetchMediaBlob();

  const [errorReporter] = useGlobal('errorReporter');
  const { showMessage } = useSnackBar();
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  const [status, setStatus] = useState(LazyAudioStatus.Idle);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // For a play that is waiting for the download
  const placeholderAudioHandleRef = useRef<AudioHandle | null>(null);
  const elRef = useRef<HTMLAudioElement | null>(null);
  const handleRef = useRef<AudioHandle | null>(null);

  // reset if media id changed
  const [prevMediaId, setPrevMediaId] = useState(mediaId);
  if (prevMediaId !== mediaId) {
    setPrevMediaId(mediaId);
    setStatus(LazyAudioStatus.Idle);
    setTime(0);
    setDuration(0);
  }

  const start = clip?.start ?? 0;
  const end = clip?.end ?? 0;
  const notifyFinish = useEffectEvent(() => onFinish?.());
  const reportError = useEffectEvent((error: Error | string) => {
    logError(Severity.error, errorReporter, error);
    showMessage(ts.mediaError);
  });

  const requestPlay = useCallback(() => {
    if (!mediaId) return;
    const handle = handleRef.current;
    if (handle) {
      audioManager.play(handle);
      return;
    }
    if (placeholderAudioHandleRef.current)
      audioManager.release(placeholderAudioHandleRef.current);
    const placeholderAudioHandle: AudioHandle = {
      play: () => {},
      stop: () => {},
    };
    placeholderAudioHandleRef.current = placeholderAudioHandle;
    // register with audioManager right away so other audio stops, and anything
    // that pauses it during loading will cancel the play
    audioManager.play(placeholderAudioHandle);
    setStatus(LazyAudioStatus.Loading);
    fetchBlob(mediaId);
  }, [mediaId, fetchBlob]);

  /** the download continues, but it will not play. */
  const cancelPlaceholder = useCallback(() => {
    if (placeholderAudioHandleRef.current)
      audioManager.release(placeholderAudioHandleRef.current);
    placeholderAudioHandleRef.current = null;
  }, []);

  // A tap on other media, or on an unmounted player, must not play later.
  useEffect(() => cancelPlaceholder, [mediaId, cancelPlaceholder]);

  // Build the element once this media's blob is fetched. A new clip rebuilds it
  // from the same blob (no refetch), stopped at the new clip start.
  useEffect(() => {
    if (blobState.id !== mediaId) return;
    if (blobState.blobStat === BlobStatus.ERROR) {
      cancelPlaceholder();
      setStatus(LazyAudioStatus.Idle);
      reportError(blobState.error || 'media fetch failed');
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
        Promise.resolve(el.play()).catch((err: unknown) => {
          setStatus(LazyAudioStatus.Idle);
          audioManager.release(handle);
          // Note if we get a DOMException 'NotAllowedError' here on safari,
          // it may be because safari requires a user interaction to start playback
          // and we are not successfully holding on to the "unlock" from the user's click
          // We don't fully support safari anyway
          reportError(err instanceof Error ? err : String(err));
        });
      },
      pause: () => el.pause(),
      stop: () => {
        el.pause();
        rewind();
      },
    };
    handleRef.current = handle;

    // WebM isn't supported right now (see TT-7899): MediaRecorder WebM reports an
    // Infinity duration, which is ignored here.
    const onDuration = () => {
      if (Number.isFinite(el.duration)) setDuration(el.duration);
    };
    const finish = () => {
      el.pause();
      rewind();
      audioManager.release(handle);
      notifyFinish();
    };
    const onTime = () => {
      const t = el.currentTime;
      if (end > 0 && t >= end) finish();
      else setTime(t);
    };
    const onPlay = () => setStatus(LazyAudioStatus.Playing);
    const onPause = () => {
      setStatus(LazyAudioStatus.Idle);
      audioManager.release(handle);
    };
    el.addEventListener('loadedmetadata', onDuration);
    el.addEventListener('durationchange', onDuration);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', finish);

    rewind();
    setStatus(LazyAudioStatus.Idle);
    // Plays only if the placeholder for the audio the user requested is still active.
    if (placeholderAudioHandleRef.current)
      audioManager.replace(placeholderAudioHandleRef.current, handle);
    placeholderAudioHandleRef.current = null;

    return () => {
      el.removeEventListener('loadedmetadata', onDuration);
      el.removeEventListener('durationchange', onDuration);
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', finish);
      el.pause();
      audioManager.release(handle);
      el.removeAttribute('src');
      URL.revokeObjectURL(url);
      if (elRef.current === el) elRef.current = null;
      if (handleRef.current === handle) handleRef.current = null;
      setStatus(LazyAudioStatus.Idle);
    };
  }, [blobState, mediaId, start, end, cancelPlaceholder]);

  const pause = useCallback(() => {
    const handle = handleRef.current;
    if (handle && !elRef.current?.paused) handle.pause?.();
    cancelPlaceholder();
  }, [cancelPlaceholder]);

  const toggle = useCallback(() => {
    if (status === LazyAudioStatus.Playing || placeholderAudioHandleRef.current)
      pause();
    else requestPlay();
  }, [status, pause, requestPlay]);

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
    status,
    position: Math.max(0, time - start),
    length: Math.max(0, stopAt - start),
    play: requestPlay,
    pause,
    toggle,
    seek,
  };
}

export default useLazyAudio;
