import { Box, Typography } from '@mui/material';
import { RecordIdentity } from '@orbit/records';
import { GroupD } from '../../model';
import TaskAvatar from '../../components/TaskAvatar';
import { findRecord, useUser } from '../../crud';
import { useGlobal } from '../../context/useGlobal';

interface IProps {
  assign: RecordIdentity;
}

export function PassageAssignee({ assign }: IProps) {
  const { getUserRec } = useUser();
  const [memory] = useGlobal('memory');

  const assigneeName =
    assign.type === 'user'
      ? getUserRec(assign.id)?.attributes?.name
      : (findRecord(memory, 'group', assign.id) as GroupD)?.attributes?.name;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <TaskAvatar assigned={assign} />
      <Typography>{assigneeName}</Typography>
    </Box>
  );
}
