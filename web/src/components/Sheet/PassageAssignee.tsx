import { Box } from '@mui/material';
import { Person } from '@mui/icons-material';
import { RecordIdentity } from '@orbit/records';
import { shallowEqual, useSelector } from 'react-redux';
import { ICardsStrings } from '../../model';
import TaskAvatar from '../../components/TaskAvatar';
import { cardsSelector } from '../../selector';

interface IProps {
  assign?: RecordIdentity;
}

export function PassageAssignee({ assign }: IProps) {
  const t: ICardsStrings = useSelector(cardsSelector, shallowEqual);

  return (
    <Box sx={{ margin: '1.5rem 0 .5rem 0' }}>
      {assign ? (
        <TaskAvatar assigned={assign} />
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Person sx={{ verticalAlign: 'middle', mb: '.5rem' }} />
          {t.unassigned || 'Unassigned'}
        </Box>
      )}
    </Box>
  );
}
