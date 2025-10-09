import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import ViewIcon from '@mui/icons-material/RemoveRedEye';
import { GridRenderCellParams } from '@mui/x-data-grid';

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
        color="primary"
        onClick={handleSelect(params.row.recId)}
      >
        {params.value}
        <ViewIcon sx={{ fontSize: '16px', ml: 1 }} />
      </Button>
    );
  }
  return <Box sx={{ display: 'flex' }}>{params.value}</Box>;
};
