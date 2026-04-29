import {
  Box,
  Card,
  Checkbox,
  IconButton,
  SxProps,
  Typography,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { IRow } from '../../../../context/PassageDetailContext';
import { SectionResourceD } from '../../../../model';
import { WrapTitle } from '../../../../control/WrapTitle';
import { useMemo } from 'react';

// This card is used for non-audio resources in the mobile list.
// It covers markdown text, URI links, PDFs, images, and other file types
// that are not routed to the audio player card.

interface IProps {
  row: IRow;
  onView: (id: string) => void;
  expandedId?: string | null;
  setExpandedId: (id: string | null) => void;
  onDone?: (id: string, res: SectionResourceD | null) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  subtitle?: string;
  sx?: SxProps;
}

export function TextResourceCard({
  row,
  onView,
  expandedId,
  setExpandedId,
  onDone,
  onEdit,
  onDelete,
  subtitle = 'Translation Resource',
  sx,
}: IProps) {
  const statusColor = useMemo(
    () => (row.done ? 'grey.400' : 'grey.700'),
    [row.done]
  );

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
        borderColor: statusColor,
        borderRadius: 2,
        backgroundColor: 'background.paper',
        px: 0.5,
        py: 1,
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
            size="medium"
            sx={{ mt: -0.5, mr: -0.5 }}
            slotProps={{
              input: { 'aria-label': `Mark ${row.artifactName} complete` },
            }}
          />
        </Box>

        <Typography variant="h6" sx={{ lineHeight: 1.25, color: statusColor }}>
          {subtitle}
        </Typography>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <IconButton
            size="small"
            // Parent decides what "view" means by content type:
            // - links open externally
            // - markdown opens the text dialog
            // - pdf/images/other files open the media/file viewer
            onClick={() => onView(row.id)}
            aria-label={`View ${row.artifactName}`}
            sx={{ p: 0.25 }}
          >
            <VisibilityIcon fontSize="medium" />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {onEdit && (
              <IconButton
                size="small"
                onClick={() => onEdit(row.id)}
                aria-label={`Edit ${row.artifactName}`}
                sx={{ p: 0.25 }}
              >
                <EditIcon fontSize="medium" />
              </IconButton>
            )}
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
      </Box>
    </Card>
  );
}
export default TextResourceCard;
