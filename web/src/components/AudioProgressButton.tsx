import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { SxProps } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { IMediaTitleStrings } from '@model/index';
import { mediaTitleSelector } from '../selector';
import ProgressPlayButton from './ProgressPlayButton';

export interface AudioProgressButtonProps {
  src: string;
  size?: number;
  bgColor?: string;
  onPlaying?: () => void;
  onPaused?: () => void;
  onEnded?: () => void;
  onError?: (e: any) => void;
  doToggle?: (cb: () => void) => void;
  sx?: SxProps;
}

export default function AudioProgressButton(
  props: Readonly<AudioProgressButtonProps>
) {
  const {
    src,
    size = 20,
    bgColor = '#bec0bfff',
    onPlaying,
    onPaused,
    onEnded,
    onError,
    doToggle,
    sx,
  } = props;
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressInterval = useRef<NodeJS.Timeout | undefined>(undefined);
  const t: IMediaTitleStrings = useSelector(mediaTitleSelector, shallowEqual);

  const handleProgress = () => {
    if (audioRef.current) {
      const current = audioRef.current.currentTime;
      const duration = audioRef.current.duration;
      if (duration) {
        const newValue = Math.floor((current / duration) * 100);
        setProgress(newValue);
      }
    }
  };

  const toggle = () => {
    if (!playing) {
      audioRef.current
        ?.play()
        .then(() => {
          onPlaying?.();
        })
        .catch((e) => {
          onError?.(e);
        });
      progressInterval.current = setInterval(handleProgress, 500);
    } else {
      audioRef.current?.pause();
      onPaused?.();
      clearInterval(progressInterval.current);
    }
    setPlaying(!playing);
  };

  useEffect(() => {
    if (doToggle) {
      doToggle(toggle);
    }
    return () => {
      clearInterval(progressInterval.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAudioEnded = () => {
    clearInterval(progressInterval.current);
    setPlaying(false);
    setProgress(0);
    onEnded?.();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', ...sx }}>
      <ProgressPlayButton
        playing={playing}
        progress={progress}
        onClick={toggle}
        title={t.playPause}
        ariaLabel="play-pause"
        size={size}
        bgColor={bgColor}
      />
      <audio ref={audioRef} src={src} onEnded={handleAudioEnded} />
    </Box>
  );
}
