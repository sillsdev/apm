import { Box, Typography } from '@mui/material';
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
    <Box>
      {assign ? (
        <TaskAvatar assigned={assign} />
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Person />
          <Typography>{t.unassigned}</Typography>
        </Box>
      )}
    </Box>
  );
}
