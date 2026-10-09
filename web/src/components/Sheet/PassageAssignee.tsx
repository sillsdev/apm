import { Box, Typography, useTheme } from '@mui/material';
import NoAccountsIcon from '@mui/icons-material/NoAccounts';
import { RecordIdentity } from '@orbit/records';
import { shallowEqual, useSelector } from 'react-redux';
import { GroupD, ICardsStrings } from '../../model';
import TaskAvatar from '../../components/TaskAvatar';
import { cardsSelector } from '../../selector';
import { avatarSize } from '../../control';
import { findRecord, useUser } from '../../crud';
import { useGlobal } from '../../context/useGlobal';

interface IProps {
  assign?: RecordIdentity;
}

export function PassageAssignee({ assign }: IProps) {
  const t: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const theme = useTheme();
  const { getUserRec } = useUser();
  const [memory] = useGlobal('memory');

  const assigneeName = !assign?.id
    ? ''
    : assign.type === 'user'
      ? getUserRec(assign.id)?.attributes?.name
      : (findRecord(memory, 'group', assign.id) as GroupD)?.attributes?.name;

  return (
    <Box>
      {assign ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <TaskAvatar assigned={assign} />
          <Typography>{assigneeName}</Typography>
        </Box>
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
