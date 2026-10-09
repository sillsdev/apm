import { Box, Typography, useTheme } from '@mui/material';
import NoAccountsIcon from '@mui/icons-material/NoAccounts';
import { RecordIdentity } from '@orbit/records';
import { shallowEqual, useSelector } from 'react-redux';
import { ICardsStrings } from '../../model';
import TaskAvatar from '../../components/TaskAvatar';
import { cardsSelector } from '../../selector';
import { avatarSize } from '../../control';

interface IProps {
  assign?: RecordIdentity;
}

export function PassageAssignee({ assign }: IProps) {
  const t: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const theme = useTheme();

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
          <NoAccountsIcon
            sx={avatarSize()}
            htmlColor={theme.palette.custom.black}
          />
          <Typography>{t.unassigned}</Typography>
        </Box>
      )}
    </Box>
  );
}
