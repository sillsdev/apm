import Box from '@mui/material/Box';
import ViewIcon from '@mui/icons-material/RemoveRedEye';
import { GridRenderCellParams } from '@mui/x-data-grid';
import { Button } from '../control/Button';

interface IProps {
  handleSelect: (passageId: string) => () => void;
}

export const TranscriptionViewCell = (
  params: GridRenderCellParams & IProps
) => {
  const { handleSelect } = params;

  if (params.row.parentId !== '') {
    const key = `link-${params.row?.id}`;
    return (
      <Button
        key={key}
        aria-label={params.value}
        startIcon={<ViewIcon />}
        onClick={handleSelect(params.row.recId)}
      >
        {params.value}
      </Button>
    );
  }
  return <Box sx={{ display: 'flex' }}>{params.value}</Box>;
};
