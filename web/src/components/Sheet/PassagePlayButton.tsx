import { useEffect, useRef, useState } from 'react';
import { Box, CircularProgress, IconButton } from '@mui/material';
import { Pause, PlayArrow } from '@mui/icons-material';
import { shallowEqual, useSelector } from 'react-redux';
import { useGlobal } from '../../context/useGlobal';
import { MediaSt, useFetchMediaUrl } from '../../crud';
import { useSnackBar } from '../../hoc/SnackBar';
import { IMediaTitleStrings, ISharedStrings } from '../../model';
import { mediaTitleSelector, sharedSelector } from '../../selector';

const buttonSize = 32;

interface IProps {
  mediaId: string;
  playing: boolean;
  active?: boolean;
  onToggle?: () => void;
}

export function PassagePlayButton({
  mediaId,
  playing,
  active = false,
  onToggle,
}: IProps) {
  const [reporter] = useGlobal('errorReporter');
  const { fetchMediaUrl, mediaState } = useFetchMediaUrl(reporter);
  const { showMessage } = useSnackBar();
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const t: IMediaTitleStrings = useSelector(mediaTitleSelector, shallowEqual);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [progress, setProgress] = useState(0);
  const [fetchedId, setFetchedId] = useState('');

  // Fetch the url the first time this media is played
  useEffect(() => {
    if (playing && fetchedId !== mediaId) {
      setFetchedId(mediaId);
      setProgress(0);
      fetchMediaUrl({ id: mediaId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, mediaId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.play().catch(() => onToggle?.());
    else audio.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, mediaState.url]);

  useEffect(() => {
    if (active) return;
    if (audioRef.current) audioRef.current.currentTime = 0;
    setProgress(0);
  }, [active]);

  useEffect(() => {
    if (!mediaState.error) return;
    showMessage(
      mediaState.error.startsWith('no offline file')
        ? ts.fileNotFound
        : mediaState.error
    );
    if (playing) onToggle?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaState.error]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const { currentTime, duration } = e.currentTarget;
    setProgress(duration ? (100 * currentTime) / duration : 0);
  };

  const handleEnded = () => {
    setProgress(0);
    if (playing) onToggle?.();
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
        onClick={onToggle}
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
