import { Badge } from '@mui/material';
import { ChevronRight } from '@mui/icons-material';
import { Button } from '../../control/Button';

interface IProps {
  step?: string;
  discussionCount?: number;
  onClick: () => void;
}

export function PassageStepButton({ step, discussionCount, onClick }: IProps) {
  return (
    <Badge
      badgeContent={discussionCount}
      color="primary"
      sx={{ display: 'flex', '& > .MuiButton-root': { flex: 1 } }}
    >
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
    </Badge>
  );
}
