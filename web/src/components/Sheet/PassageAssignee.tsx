import { Box, Tooltip } from '@mui/material';
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
    <Tooltip title={assigneeName ?? ''}>
      <Box sx={{ alignSelf: 'flex-start' }}>
        <TaskAvatar assigned={assign} />
      </Box>
    </Tooltip>
  );
}
