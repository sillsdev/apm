import { Box, Card, Checkbox, SxProps, Typography } from '@mui/material';
import { IRow } from '../../../../context/PassageDetailContext';
import { SectionResourceD } from '../../../../model';
import LimitedMediaPlayer from '../../../LimitedMediaPlayer';

// This card is used for audio resources in the mobile list.
// It is selected when the media content type starts with "audio/"
// (for example mp3, m4a, wav, ogg).

interface IProps {
  row: IRow;
  isPlaying: boolean;
  onPlay: (id: string) => void;
  onDone?: (id: string, res: SectionResourceD | null) => void;
  onEnded?: () => void;
  subtitle?: string;
  limits?: {
    start?: number;
    end?: number;
  };
  sx?: SxProps;
}

export function AudioResourceCard({
  row,
  isPlaying,
  onPlay,
  onDone,
  onEnded,
  subtitle = 'Scripture',
  limits,
  sx,
}: IProps) {
  const handleDoneToggle = () => {
    if (onDone) {
      onDone(row.id, row.resource);
    }
  };

  return (
    <Card
      elevation={0}
      sx={{
        border: '2px solid',
        borderColor: 'grey.700',
        borderRadius: 2,
        backgroundColor: 'background.paper',
        p: 1,
        ...sx,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ lineHeight: 1.25 }}>
            {row.artifactName}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
        <Checkbox
          checked={Boolean(row.done)}
          onChange={handleDoneToggle}
          size="small"
          sx={{ mt: -0.5, mr: -0.5 }}
          inputProps={{
            'aria-label': `Mark ${row.artifactName} complete`,
          }}
        />
      </Box>
      <Box sx={{ mt: 1 }}>
        {/* Audio playback UI for audio/* resource files. */}
        <LimitedMediaPlayer
          srcMediaId={row.id}
          requestPlay={isPlaying}
          onEnded={onEnded ?? (() => {})}
          onTogglePlay={() => onPlay(row.id)}
          controls
          limits={limits ?? {}}
          noClose
          noRestart
          noSkipBack
          sx={{ borderRadius: 1, bgcolor: 'grey.100' }}
        />
      </Box>
    </Card>
  );
}

export default AudioResourceCard;
