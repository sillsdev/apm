import { useRef, useState, useEffect } from 'react';
import { useGlobal } from '../context/useGlobal';
import { useFetchMediaUrl, MediaSt } from '../crud';
import { logError, Severity } from '../utils';
import { useSnackBar } from '../hoc/SnackBar';
import { ISharedStrings } from '../model';
import { sharedSelector } from '../selector';
import { shallowEqual, useSelector } from 'react-redux';
import Box, { type BoxProps } from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Fab from '@mui/material/Fab';
import { FaPlay, FaPause } from 'react-icons/fa';
import { styled, useTheme, SxProps } from '@mui/material';

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

interface AudioProgressButtonProps {
  srcMediaId: string;
  requestPlay: boolean;
  onEnded: () => void;
  onTogglePlay?: () => void;
  onCancel?: () => void;
  size?: number;
  bgColor?: string;
  onLoaded?: () => void;
  sx?: SxProps;
}

export function AudioProgressButton(props: AudioProgressButtonProps) {
  const {
    srcMediaId,
    requestPlay,
    onLoaded,
    onEnded,
    onTogglePlay,
    size = 20,
    bgColor = '#e2e2e2',
    sx,
  } = props;
  const [reporter] = useGlobal('errorReporter');
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playSuccess = useRef(false);
  const [playing, setPlayingx] = useState(false);
  const playingRef = useRef(false);
  const [playItem, setPlayItem] = useState('');
  const [ready, setReady] = useState(false);
  const durationSet = useRef(false);
  const { showMessage } = useSnackBar();
  const [progress, setProgress] = useState(0);
  const progressInterval = useRef<NodeJS.Timeout | undefined>(undefined);
  const theme = useTheme();
  const color = theme.palette.getContrastText(bgColor);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

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
      audioRef.current?.play();
      progressInterval.current = setInterval(handleProgress, 500);
    } else {
      audioRef.current?.pause();
      clearInterval(progressInterval.current);
    }
    onTogglePlay?.();
  };

  useEffect(() => {
    return () => {
      clearInterval(progressInterval.current);
    };
  }, []);

  const setPlaying = (x: boolean) => {
    setPlayingx(x);
    playingRef.current = x;
  };

  const startPlay = () => {
    if (playing || playSuccess.current) return;
    setPlaying(true);
    playSuccess.current = false;
    if (audioRef.current) {
      audioRef.current
        .play()
        .then(() => {
          if (audioRef.current) playSuccess.current = true;
          progressInterval.current = setInterval(handleProgress, 500);
        })
        .catch(() => {
          playSuccess.current = false;
        });
    }
  };

  const stopPlay = () => {
    if (playing) {
      toggle();
      setPlaying(false);
    }
    playSuccess.current = false;
  };

  const durationChange = () => {
    //this is called multiple times for some files
    const el = audioRef.current as HTMLMediaElement;
    if (!durationSet.current && el?.duration) {
      durationSet.current = true;
      onLoaded && onLoaded();
    }
  };

  useEffect(() => {
    if (playingRef.current) {
      if (audioRef.current) {
        if (playSuccess.current) audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      stopPlay();
    }
    durationSet.current = false;
    if (srcMediaId !== playItem) {
      setReady(false);
      fetchMediaUrl({ id: srcMediaId });
      setPlayItem(srcMediaId);
    } else {
      durationChange();
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
      onEnded();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaState]);

  useEffect(() => {
    stopPlay();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playItem]);

  useEffect(() => {
    if (ready && audioRef.current && playItem !== '' && requestPlay) {
      if (!playing) startPlay();
    } else if (!requestPlay) {
      if (playingRef.current) {
        if (audioRef.current && playSuccess.current) audioRef.current.pause();
        stopPlay();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, requestPlay, playing, playItem]);

  const ended = () => {
    if (audioRef.current) audioRef.current.currentTime = 0;
    setProgress(0);
    stopPlay();
    if (onEnded) onEnded();
  };

  const handleError = (e: any) => {
    logError(Severity.error, reporter, e);
    // showMessage(e.target?.error?.message || ts.mediaError);
    showMessage(ts.mediaError);
  };

  return ready ? (
    <Box sx={{ display: 'flex', alignItems: 'center', ...sx }}>
      <StyledBox sx={{ m: 1, position: 'relative' }} size={size}>
        <Fab
          aria-label="play-pause"
          sx={{ backgroundColor: bgColor, color: color }}
          onClick={() => {
            toggle();
            setPlaying(!playing);
          }}
        >
          {playing ? <FaPause size={size / 2} /> : <FaPlay size={size / 2} />}
        </Fab>
        {Math.round(progress) !== 0 && (
          <CircularProgress
            variant="determinate"
            value={progress}
            size={size + 8}
            sx={{
              color: color,
              position: 'absolute',
              top: -2,
              left: -4,
              zIndex: 1,
            }}
          />
        )}
      </StyledBox>
      <audio
        ref={audioRef}
        src={mediaState.url}
        onEnded={ended}
        onError={handleError}
      />
    </Box>
  ) : (
    <></>
  );
}
export default AudioProgressButton;
