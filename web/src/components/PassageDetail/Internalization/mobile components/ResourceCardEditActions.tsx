import { IconButton } from '@mui/material';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { shallowEqual, useSelector } from 'react-redux';
import { IRow } from '../../../../context/PassageDetailContext';
import { IMediaActionsStrings } from '../../../../model';
import { mediaActionsSelector } from '../../../../selector';
import { LightTooltip } from '../../../../control/LightTooltip';
import { useMobile } from '../../../../utils/useMobile';

interface IProps {
  row: IRow;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

/** A resource card's Edit and Delete buttons; hidden at phone width. */
export function ResourceCardEditActions({ row, onEdit, onDelete }: IProps) {
  const { isMobileWidth } = useMobile();
  const t: IMediaActionsStrings = useSelector(
    mediaActionsSelector,
    shallowEqual
  );
  if (isMobileWidth) return null;

  return (
    <>
      {onEdit && (
        <LightTooltip title={t.edit}>
          <IconButton
            size="small"
            onClick={() => onEdit(row.id)}
            aria-label={t.edit}
            sx={{ p: 0.25 }}
          >
            <EditIcon fontSize="medium" />
          </IconButton>
        </LightTooltip>
      )}
      {onDelete && (
        <LightTooltip title={t.delete}>
          <IconButton
            size="small"
            onClick={() => onDelete(row.id)}
            aria-label={t.delete}
            sx={{ p: 0.25 }}
          >
            <DeleteOutlineIcon fontSize="medium" />
          </IconButton>
        </LightTooltip>
      )}
    </>
  );
}

export default ResourceCardEditActions;
