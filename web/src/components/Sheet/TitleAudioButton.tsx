import { CircularProgress, IconButton } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { usePassagePlayback } from './usePassagePlayback';

interface IProps {
  mediaId: string;
}

export function TitleAudioButton({ mediaId }: IProps) {
  const { playing, loading, play, audio } = usePassagePlayback(mediaId);

  return (
    <>
      <IconButton
        data-testid="speaker-button"
        onClick={play}
        disabled={playing}
        sx={{
          color: 'custom.black',
          '&.Mui-disabled': {
            color: 'primary.main',
            // MUI disables pointer events, which would hide the cursor
            pointerEvents: 'auto',
            cursor: 'not-allowed',
            '&:hover': { backgroundColor: 'transparent' },
          },
        }}
      >
        {loading ? <CircularProgress size={20} /> : <VolumeUpIcon />}
      </IconButton>
      {audio}
    </>
  );
}
