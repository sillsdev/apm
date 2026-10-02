import { type GridRenderCellParams } from '@mui/x-data-grid';
import { IconButton, Box } from '@mui/material';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import { RecordKeyMap } from '@orbit/records';
import { shallowEqual, useSelector } from 'react-redux';
import { IMediaActionsStrings } from '../../model';
import { IRow } from '.';
import { useGlobal } from '../../context/useGlobal';
import { remoteId } from '../../crud/remoteId';
import { isElectron } from '../../../api-variable';
import AudioDownload from '../AudioDownload';
import { mediaActionsSelector } from '../../selector';

interface IProps {
  canCreate: boolean;
  readonly: boolean;
  handleConfirmAction: (i: string) => void;
}

export default function DetachCell(
  params: GridRenderCellParams<IRow> & IProps
) {
  const [memory] = useGlobal('memory');
  const { canCreate, readonly, handleConfirmAction: onDelete } = params;
  const canDelete = !readonly && !params.row.readyToShare;
  const mediaId =
    remoteId('mediafile', params.row.id, memory?.keyMap as RecordKeyMap) ||
    params.row.id;
  const t: IMediaActionsStrings = useSelector(
    mediaActionsSelector,
    shallowEqual
  );

  const handleDelete = () => {
    onDelete(params.row.id);
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      {(isElectron || canCreate) && <AudioDownload mediaId={mediaId} />}
      {canDelete && !readonly && (
        <IconButton
          id="audActDel"
          sx={{ color: 'primary.light' }}
          title={t.delete}
          onClick={handleDelete}
        >
          <DeleteIcon />
        </IconButton>
      )}
    </Box>
  );
}
