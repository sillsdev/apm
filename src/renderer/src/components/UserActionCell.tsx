import { type GridRenderCellParams } from '@mui/x-data-grid';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useGlobal } from '../context/useGlobal';
import { IRow } from './UserTable';
import { useRole } from '../crud/useRole';

interface IProps {
  handleEdit: (userId: string) => () => void;
  handleDelete: (value: string) => () => void;
  admins: IRow[];
}

export default function PlayCell(params: GridRenderCellParams<IRow> & IProps) {
  const [user] = useGlobal('user');
  const { value, handleEdit, handleDelete, admins } = params;
  const { userIsAdmin } = useRole();

  const isCurrentUser = (userId: string) => userId === user;

  return (
    <>
      <IconButton
        id={'edit-' + value}
        key={'edit-' + value}
        aria-label={'edit-' + value}
        color="default"
        onClick={handleEdit(value)}
        disabled={isCurrentUser(value)}
      >
        <EditIcon />
      </IconButton>
      <IconButton
        id={'del-' + value}
        key={'del-' + value}
        aria-label={'del-' + value}
        color="default"
        onClick={handleDelete(value)}
        disabled={
          userIsAdmin
            ? admins.length === 1 && isCurrentUser(value)
            : !isCurrentUser(value)
        }
      >
        <DeleteIcon />
      </IconButton>
    </>
  );
}
