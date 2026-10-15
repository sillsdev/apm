import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, IconButton } from '@mui/material';
import { Pause, PlayArrow } from '@mui/icons-material';
import { shallowEqual, useSelector } from 'react-redux';
import { useGlobal } from '../../context/useGlobal';
import { MediaSt, useFetchMediaUrl } from '../../crud';
import { useSnackBar } from '../../hoc/SnackBar';
import { IMediaTitleStrings, ISharedStrings } from '../../model';
import { mediaTitleSelector, sharedSelector } from '../../selector';

const buttonSize = 32;

// Only one passage plays at a time: starting one stops whichever was playing.
let stopActive: (() => void) | undefined;

interface IProps {
  mediaId: string;
}

export function PassagePlayButton({ mediaId }: IProps) {
  const [reporter] = useGlobal('errorReporter');
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const { showMessage } = useSnackBar();
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const t: IMediaTitleStrings = useSelector(mediaTitleSelector, shallowEqual);
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

  const handleToggle = () => {
    if (playing) {
      setPlaying(false);
      audioRef.current?.pause();
      return;
    }
    if (stopActive !== stop) stopActive?.();
    stopActive = stop;
    setPlaying(true);
    // Fetch the url the first time this media is played
    if (fetchedId !== mediaId) {
      setFetchedId(mediaId);
      fetchMediaUrl({ id: mediaId });
    }
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

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <CircularProgress
        variant="determinate"
        value={100}
        size={buttonSize}
        thickness={3}
        sx={{ position: 'absolute', color: 'grey.300' }}
      />
      <CircularProgress
        variant={loading ? 'indeterminate' : 'determinate'}
        value={progress}
        size={buttonSize}
        thickness={3}
        sx={{ position: 'absolute', color: 'primary.main' }}
      />
      <IconButton
        data-testid="play-button"
        aria-label={t.playPause}
        title={t.playPause}
        onClick={handleToggle}
        sx={{ width: buttonSize, height: buttonSize, color: 'custom.black' }}
      >
        {playing ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
      </IconButton>
      {mediaState.url && (
        <audio
          ref={audioRef}
          src={mediaState.url}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />
      )}
    </Box>
  );
}
