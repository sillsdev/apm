import { IconButton } from '@mui/material';
import { PlayCircleOutline } from '@mui/icons-material';
import { LoadAndPlay } from './LoadAndPLay';
import AudioProgressButton from './AudioProgressButton';

interface IPlayButtonProps {
  mediaId?: string;
  isPlaying: boolean;
  onPlayStatus?: () => void;
  onPlayEnd: () => void;
  sx?: any;
}

export function PlayButton({
  mediaId,
  isPlaying,
  onPlayStatus,
  onPlayEnd,
  sx = { width: 40, height: 40 },
}: IPlayButtonProps) {
  if (!mediaId) {
    return <></>;
  }

  // Show play button for all passage types when media is available

  if (isPlaying) {
    return (
      <LoadAndPlay
        Component={AudioProgressButton}
        srcMediaId={mediaId}
        requestPlay={isPlaying}
        onEnded={onPlayEnd}
        onTogglePlay={onPlayStatus}
        sx={sx}
      />
    );
  }

  return (
    <IconButton onClick={onPlayStatus}>
      <PlayCircleOutline fontSize="large" color="primary" />
    </IconButton>
  );
}
