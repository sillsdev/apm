import { useEffect, useRef, useState } from 'react';
import Box, { type BoxProps } from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import { FaPlay, FaPause } from 'react-icons/fa';
import { styled, SxProps, Tooltip, useTheme } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { IMediaTitleStrings } from '@model/index';
import { mediaTitleSelector } from '../selector';

// see: https://mui.com/material-ui/customization/how-to-customize/
interface StyledBoxProps extends BoxProps {
  size?: number;
}
const StyledBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'size' && prop !== 'bgColor',
})<StyledBoxProps>(({ size }) => ({
  '& .MuiFab-root': {
    width: size ? `${size}px!important` : '30px',
    height: size ? `${size}px!important` : '30px',
    minHeight: size ? `${size}px!important` : '30px',
  },
}));

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

export default function AudioProgressButton(props: AudioProgressButtonProps) {
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
  const theme = useTheme();
  const color = theme.palette.getContrastText(bgColor);
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
  }, []);

  const handleAudioEnded = () => {
    clearInterval(progressInterval.current);
    setPlaying(false);
    setProgress(0);
    onEnded?.();
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', ...sx }}>
      <StyledBox sx={{ m: 1, position: 'relative' }} size={size}>
        <Tooltip title={t.playPause}>
          <Fab
            aria-label="play-pause"
            sx={{ backgroundColor: bgColor, color: color }}
            onClick={toggle}
          >
            {playing ? <FaPause size={size / 2} /> : <FaPlay size={size / 2} />}
          </Fab>
        </Tooltip>
        {Math.round(progress) !== 0 && (
          <CircularProgress
            variant="determinate"
            value={progress}
            size={size + 8}
            sx={{
              color: 'primary.main',
              position: 'absolute',
              top: -2,
              left: -4,
              zIndex: 1,
            }}
          />
        )}
      </StyledBox>
      <audio ref={audioRef} src={src} onEnded={handleAudioEnded} />
    </Box>
  );
}
