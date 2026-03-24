import { Box, Card, Checkbox, IconButton, SxProps, Typography } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
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
  onDelete?: (id: string) => void;
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
  onDelete,
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
        width: '100%',
        minHeight: 'clamp(7.5rem, 16vw, 9rem)',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
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
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: 0,
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
          <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
            <Typography variant="h6" sx={{ lineHeight: 1.25 }} noWrap>
              {row.artifactName}
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
        <Typography variant="h6" sx={{ lineHeight: 1.25 }}>
          {subtitle}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          {/* Audio playback UI for audio/* resource files. */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
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
              playButtonSize="large"
              sx={{ borderRadius: 1, bgcolor: 'grey.100' }}
            />
          </Box>
          {onDelete && (
            <IconButton
              size="small"
              onClick={() => onDelete(row.id)}
              aria-label={`Delete ${row.artifactName}`}
              sx={{ p: 0.25 }}
            >
              <DeleteOutlineIcon fontSize="medium" />
            </IconButton>
          )}
        </Box>
      </Box>
    </Card>
  );
}

export default AudioResourceCard;
