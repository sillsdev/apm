import { useCallback, useEffect, useRef, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { useGlobal } from '../../context/useGlobal';
import { MediaSt, useFetchMediaUrl } from '../../crud';
import { useSnackBar } from '../../hoc/SnackBar';
import { ISharedStrings } from '../../model';
import { sharedSelector } from '../../selector';

// Only one passage plays at a time: starting one stops whichever was playing.
let stopActive: (() => void) | undefined;

export function usePassagePlayback(mediaId: string) {
  const [reporter] = useGlobal('errorReporter');
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const { showMessage } = useSnackBar();
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fetchedId, setFetchedId] = useState('');

  // Stop and rewind, e.g. when another passage starts playing
  const stop = useCallback(() => {
    setPlaying(false);
    setProgress(0);
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  useEffect(
    () => () => {
      stop();
      if (stopActive === stop) stopActive = undefined;
    },
    [mediaId, stop]
  );

  // Play once the url is available, which may be after the click
  useEffect(() => {
    if (playing) audioRef.current?.play().catch(() => setPlaying(false));
  }, [playing, mediaState.url]);

  useEffect(() => {
    if (!mediaState.error) return;
    showMessage(
      mediaState.error.startsWith('no offline file')
        ? ts.fileNotFound
        : mediaState.error
    );
    setPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaState.error]);

  const play = () => {
    if (stopActive !== stop) stopActive?.();
    stopActive = stop;
    setPlaying(true);
    // Fetch the url the first time this media is played
    if (fetchedId !== mediaId) {
      setFetchedId(mediaId);
      fetchMediaUrl({ id: mediaId });
    }
  };

  const toggle = () => {
    if (!playing) return play();
    setPlaying(false);
    audioRef.current?.pause();
  };

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const { currentTime, duration } = e.currentTarget;
    setProgress(duration ? (100 * currentTime) / duration : 0);
  };

  const handleEnded = () => {
    setProgress(0);
    setPlaying(false);
  };

  const loading = playing && mediaState.status === MediaSt.PENDING;

  const audio = mediaState.url ? (
    <audio
      ref={audioRef}
      src={mediaState.url}
      onTimeUpdate={handleTimeUpdate}
      onEnded={handleEnded}
    />
  ) : null;

  return { playing, loading, progress, play, toggle, audio };
}
