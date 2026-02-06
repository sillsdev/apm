import { Box, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import UndoIcon from '@mui/icons-material/Undo';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { shallowEqual, useSelector } from 'react-redux';
import { IMobileStrings } from '../../../model';
import { mobileSelector } from '../../../selector';

interface Props {
  disabled?: boolean;
  onAdd: () => void;
  onRemoveNext: () => void;
  onUndoReset: () => void;
  onResetBackTranslation: () => void;
}

export default function SegmentControlsMobile({
  disabled,
  onAdd,
  onRemoveNext,
  onUndoReset,
  onResetBackTranslation,
}: Props) {
  const t: IMobileStrings = useSelector(mobileSelector, shallowEqual);
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 1.5,
        py: 0.5,
      }}
    >
      <Tooltip title={t?.addSegment ?? 'Add segment boundary'}>
        <span>
          <IconButton onClick={onAdd} disabled={disabled}>
            <AddIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t?.removeSegment ?? 'Remove next segment boundary'}>
        <span>
          <IconButton onClick={onRemoveNext} disabled={disabled}>
            <RemoveIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip
        title={t?.restoreBoundaries ?? 'Restore original segment boundaries'}
      >
        <span>
          <IconButton onClick={onUndoReset} disabled={disabled}>
            <UndoIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title={t?.resetBT ?? 'Reset back translation'}>
        <span>
          <IconButton onClick={onResetBackTranslation} disabled={disabled}>
            <RestartAltIcon />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
}
