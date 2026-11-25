import { Box, Card, Checkbox, SxProps, Typography } from '@mui/material';
import { IRow } from '../../../../context/PassageDetailContext';
import { SectionResourceD } from '../../../../model';
import MinimalAudioPlayer from '../../../MinimalAudioPlayer';
import { useMemo } from 'react';
import { WrapTitle } from '../../../../control/WrapTitle';
import { resourceClip } from '../resourceClip';
import { ResourceCardEditActions } from './ResourceCardEditActions';

// This card is used for audio resources in the mobile list.
// It is selected when the media content type starts with "audio/"
// (for example mp3, m4a, wav, ogg).

interface IProps {
  row: IRow;
  expandedId?: string | null;
  setExpandedId: (id: string | null) => void;
  onDone?: (id: string, res: SectionResourceD | null) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  subtitle?: string;
  /** Type tag shown beside the subtitle (e.g. "Linked"). */
  badge?: string;
  sx?: SxProps;
}

export function AudioResourceCard({
  row,
  expandedId,
  setExpandedId,
  onDone,
  onEdit,
  onDelete,
  // TODO cleanup: hard-coded English default, shown when a resource has no
  // category; localize it or show nothing.
  subtitle = 'Scripture',
  badge,
  sx = [],
}: IProps) {
  const segments = row.mediafile?.attributes?.segments;
  const clip = useMemo(
    () => resourceClip(row.mediafile),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [segments]
  );

  const handleDoneToggle = () => {
    if (onDone) {
      onDone(row.id, row.resource);
    }
  };

  const statusColor = useMemo(
    () => (row.done ? 'grey.400' : 'grey.700'),
    [row.done]
  );

  return (
    <Card
      elevation={0}
      sx={[
        {
          width: '100%',
          minHeight: 'clamp(7.5rem, 16vw, 9rem)',
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: '2px solid',
          borderColor: statusColor,
          borderRadius: 2,
          backgroundColor: 'background.paper',
          px: 2,
          py: 1.5,
        },
        ...[sx].flat(),
      ]}
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
            justifyContent: 'space-between',
            gap: 1,
          }}
        >
          <Box sx={{ minWidth: 0, overflow: 'hidden' }}>
            <WrapTitle
              id={row.id}
              expandedId={expandedId}
              setExpandedId={setExpandedId}
              typographyProps={{
                variant: 'h6',
                sx: {
                  lineHeight: 1.25,
                  color: statusColor,
                  fontWeight: undefined,
                },
              }}
            >
              {row.artifactName}
            </WrapTitle>
          </Box>
          <Checkbox
            checked={Boolean(row.done)}
            onChange={handleDoneToggle}
            size="small"
            sx={{ mt: -0.5, mr: -0.5 }}
            slotProps={{
              input: {
                // TODO cleanup: hard-coded English; localize or change to a localized string we already have?
                'aria-label': `Mark ${row.artifactName} complete`,
              },
            }}
          />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="h6"
            sx={{ lineHeight: 1.25, color: statusColor }}
          >
            {subtitle}
          </Typography>
          {badge && (
            <Typography
              component="span"
              variant="body2"
              sx={{
                px: 1,
                py: 0.25,
                borderRadius: 1,
                backgroundColor: 'grey.200',
                color: 'text.secondary',
                whiteSpace: 'nowrap',
              }}
            >
              {badge}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* Audio playback UI for audio/* resource files. */}
          <Box sx={{ flex: 1, minWidth: 0, pr: 2 }}>
            <MinimalAudioPlayer
              srcMediaId={row.id}
              clip={clip}
              playButtonSize="large"
            />
          </Box>
          <ResourceCardEditActions
            row={row}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </Box>
      </Box>
    </Card>
  );
}

export default AudioResourceCard;
