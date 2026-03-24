import { Box, Card, Checkbox, IconButton, SxProps, Typography } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { IRow } from '../../../../context/PassageDetailContext';
import { SectionResourceD } from '../../../../model';

// This card is used for non-audio resources in the mobile list.
// It covers markdown text, URI links, PDFs, images, and other file types
// that are not routed to the audio player card.

interface IProps {
  row: IRow;
  onView: (id: string) => void;
  onDone?: (id: string, res: SectionResourceD | null) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  subtitle?: string;
  sx?: SxProps;
}

export function TextResourceCard({
  row,
  onView,
  onDone,
  onEdit,
  onDelete,
  subtitle = 'Translation Resource',
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
        px: 1.25,
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
            <Typography variant="h6" sx={{ lineHeight: 1.25 }} noWrap>
              {row.artifactName}
            </Typography>
          </Box>
          <Checkbox
            checked={Boolean(row.done)}
            onChange={handleDoneToggle}
            size="medium"
            sx={{ mt: -0.5, mr: -0.5 }}
            inputProps={{
              'aria-label': `Mark ${row.artifactName} complete`,
            }}
          />
        </Box>

        <Typography variant="h6" sx={{ lineHeight: 1.25 }}>
          {subtitle}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
