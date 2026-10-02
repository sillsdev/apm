import { useState } from 'react';
import { IconButton } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  DataGrid,
  type DataGridProps,
  type GridColDef,
} from '@mui/x-data-grid';

interface IParams {
  recIdName: string;
  expanded?: (ids: string[]) => void;
}

export function TreeDataGrid(props: DataGridProps & IParams) {
  const { recIdName, expanded } = props;
  const [openRows, setOpenRows] = useState<string[]>([]);

  const handleExpand = (sectionId: string) => {
    const newRows = openRows.includes(sectionId)
      ? openRows.filter((i) => i !== sectionId)
      : [...openRows, sectionId];
    setOpenRows(newRows);
    expanded?.(newRows);
  };

  const handleExpandAll = () => {
    const newRows =
      openRows.length > 0
        ? []
        : (props.rows?.map((r) => r[recIdName] as string) ?? []);
    setOpenRows(newRows);
    expanded?.(newRows);
  };

  const columns: GridColDef[] = [
    {
      field: 'expand',
      headerName: '',
      renderHeader: () => (
        <IconButton onClick={handleExpandAll}>
          {openRows.length > 0 ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      ),
      width: 50,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        const recId = params.row[recIdName] as string;
        return !params.row.parentId ? (
          <IconButton onClick={() => handleExpand(recId)}>
            {!openRows?.includes(recId) ? (
              <ChevronRightIcon />
            ) : (
              <ExpandLessIcon />
            )}
          </IconButton>
        ) : null;
      },
    },
  ];
  if (props.columns) columns.push(...props.columns);
  return <DataGrid {...props} columns={columns} disableRowSelectionOnClick />;
}
