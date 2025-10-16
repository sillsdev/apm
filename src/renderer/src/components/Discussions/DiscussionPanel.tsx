import { useContext, useMemo } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import {
  DiscussionD,
  MediaFileD,
  GroupMembership,
  IDiscussionListStrings,
} from '../../model';
import { Badge, Box, Fab, Grid } from '@mui/material';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import DiscussionList from './DiscussionList';
import DiscussIcon from '../../control/DiscussIcon';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useDiscussionCount } from '../../crud/useDiscussionCount';
import { discussionListSelector } from '../../selector';

export default function DiscussionPanel() {
  const ctx = useContext(PassageDetailContext);
  const {
    discussionSize,
    mediafileId,
    discussOpen,
    passage,
    currentstep,
    setDiscussOpen,
  } = ctx.state;
  const discussions = useOrbitData<DiscussionD[]>('discussion');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const groupmemberships = useOrbitData<GroupMembership[]>('groupmembership');
  const t: IDiscussionListStrings = useSelector(
    discussionListSelector,
    shallowEqual
  );
  const getDiscussionCount = useDiscussionCount({
    mediafiles,
    discussions,
    groupmemberships,
  });
  const discussionCount = useMemo(
    () => getDiscussionCount(passage.id, currentstep, true),
    [passage.id, currentstep, getDiscussionCount]
  );

  return (
    Boolean(mediafileId) &&
    (discussOpen ? (
      <Grid
        size={{ xs: 12 }}
        container
        sx={{ width: discussionSize.width, justifyContent: 'center' }}
      >
        <Grid container direction="column">
          <DiscussionList onClose={() => setDiscussOpen(false)} />
        </Grid>
      </Grid>
    ) : (
      <Box sx={{ position: 'fixed', bottom: 10, right: 10, zIndex: 1000 }}>
        {discussionCount > 0 ? (
          <Badge badgeContent={discussionCount} color="primary">
            <Fab
              size="small"
              onClick={() => setDiscussOpen(true)}
              title={t.open}
            >
              <DiscussIcon />
            </Fab>
          </Badge>
        ) : (
          <Fab size="small" onClick={() => setDiscussOpen(true)}>
            <DiscussIcon />
          </Fab>
        )}
      </Box>
    ))
  );
}
