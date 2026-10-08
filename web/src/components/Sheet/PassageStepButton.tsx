import { ChevronRight } from '@mui/icons-material';
import { Button } from '../../control/Button';

interface IProps {
  step?: string;
  onClick: () => void;
}

export function PassageStepButton({ step, onClick }: IProps) {
  return (
    <Button
      data-cy="passage-card-step"
      sx={{
        position: 'relative',
        '& .MuiTypography-root': {
          fontWeight: 'bold',
          maxWidth: '80%',
        },
        '& .MuiButton-endIcon': {
          position: 'absolute',
          right: 12,
          m: 0,
        },
      }}
      color="primary"
      endIcon={<ChevronRight />}
      onClick={onClick}
    >
      {step}
    </Button>
  );
}
