import { Box, CircularProgress, IconButton } from '@mui/material';
import { Pause, PlayArrow } from '@mui/icons-material';
import { shallowEqual, useSelector } from 'react-redux';
import { IMediaTitleStrings } from '../../model';
import { mediaTitleSelector } from '../../selector';
import { usePassagePlayback } from './usePassagePlayback';

const buttonSize = 32;

interface IProps {
  mediaId: string;
}

export function PassagePlayButton({ mediaId }: IProps) {
  const { playing, loading, progress, toggle, audio } =
    usePassagePlayback(mediaId);
  const t: IMediaTitleStrings = useSelector(mediaTitleSelector, shallowEqual);

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
        onClick={toggle}
        sx={{ width: buttonSize, height: buttonSize, color: 'custom.black' }}
      >
        {playing ? <Pause fontSize="small" /> : <PlayArrow fontSize="small" />}
      </IconButton>
      {audio}
    </Box>
  );
}
