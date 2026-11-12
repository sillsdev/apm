import { useRef, useState, useEffect } from 'react';
import { useGlobal } from '../context/useGlobal';
import { useFetchMediaUrl, MediaSt } from '../crud';
import { useSnackBar } from '../hoc/SnackBar';
import { ISharedStrings } from '../model';
import { sharedSelector } from '../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { SxProps } from '@mui/material';
import { type AudioProgressButtonProps } from './AudioProgressButton';

interface LoadAndPlayProps {
  srcMediaId: string;
  requestPlay: boolean;
  onPlaying?: () => void;
  onPaused?: () => void;
  onTogglePlay?: () => void;
  onEnded?: () => void;
  onError?: (e: any) => void;
  Component: (props: AudioProgressButtonProps) => React.ReactNode;
  sx?: SxProps;
}

export function LoadAndPlay(props: LoadAndPlayProps) {
  const {
    srcMediaId,
    requestPlay,
    onEnded,
    onPlaying,
    onPaused,
    onTogglePlay,
    onError,
    Component,
    sx,
  } = props;
  const [reporter] = useGlobal('errorReporter');
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlayingx] = useState(false);
  const [togglePlay, setTogglePlay] = useState<() => void>(() => {});
  const playingRef = useRef(false);
  const [playItem, setPlayItem] = useState('');
  const [ready, setReady] = useState(false);
  const { showMessage } = useSnackBar();
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  const setPlaying = (playing: boolean) => {
    playingRef.current = playing;
    setPlayingx(playing);
  };

  useEffect(() => {
    if (srcMediaId !== playItem) {
      setReady(false);
      fetchMediaUrl({ id: srcMediaId });
      setPlayItem(srcMediaId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcMediaId]);

  // Cleanup blob URLs when component unmounts or media changes
  useEffect(() => {
    return () => {
      if (mediaState.url && mediaState.url.startsWith('blob:')) {
        URL.revokeObjectURL(mediaState.url);
      }
    };
  }, [mediaState.url]);

  useEffect(() => {
    if (mediaState.id !== srcMediaId && mediaState.remoteId !== srcMediaId)
      return;
    if (mediaState.status === MediaSt.FETCHED) setReady(true);
    if (mediaState.error) {
      if (mediaState.error.startsWith('no offline file'))
        showMessage(ts.fileNotFound);
      else showMessage(mediaState.error);
      onEnded?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaState]);

  useEffect(() => {
    if (ready && playItem !== '' && requestPlay) {
      if (!playing) togglePlay?.();
    } else if (!requestPlay) {
      if (playingRef.current) {
        if (audioRef.current && playingRef.current) audioRef.current.pause();
        togglePlay?.();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, requestPlay, playing, playItem]);

  const handlePlaying = () => {
    if (!playingRef.current) onTogglePlay?.();
    onPlaying?.();
    setPlaying(true);
  };

  const handlePaused = () => {
    if (playingRef.current) onTogglePlay?.();
    onPaused?.();
    setPlaying(false);
  };

  const handleEnded = () => {
    onEnded?.();
    setPlaying(false);
  };

  return ready ? (
    <Component
      src={mediaState.url}
      onPlaying={handlePlaying}
      onPaused={handlePaused}
      onEnded={handleEnded}
      onError={onError}
      doToggle={setTogglePlay}
      sx={sx}
    />
  ) : (
    <></>
  );
}
export default LoadAndPlay;
