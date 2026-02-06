import { useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
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
  const { pathname } = useLocation();
  const isDetail = pathname.startsWith('/detail');
  const discussions = useOrbitData<DiscussionD[]>('discussion');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const groupmemberships = useOrbitData<GroupMembership[]>('groupmembership');
  const t: IDiscussionListStrings = useSelector(
    discussionListSelector,
    shallowEqual
  );
  const [windowWidth, setWindowWidth] = useState(
    typeof window === 'undefined' ? discussionSize.width : window.innerWidth
  );
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const panelWidth = Math.min(discussionSize.width, windowWidth);
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
        sx={{
          width: panelWidth,
          maxWidth: '100%',
          justifyContent: 'center',
        }}
      >
        <Grid container direction="column">
          <DiscussionList onClose={() => setDiscussOpen(false)} />
        </Grid>
      </Grid>
    ) : (
      <Box
        sx={{
          position: 'fixed',
          bottom: isDetail ? 50 : 10,
          right: 10,
          zIndex: 1000,
        }}
      >
        {discussionCount > 0 ? (
          <Badge badgeContent={discussionCount} color="primary">
            <Fab
              size="small"
              onClick={() => setDiscussOpen(true)}
              title={t.open}
            >
              <DiscussIcon width={40} height={40} />
            </Fab>
          </Badge>
        ) : (
          <Fab size="small" onClick={() => setDiscussOpen(true)} title={t.open}>
            <DiscussIcon width={40} height={40} />
          </Fab>
        )}
      </Box>
    ))
  );
}
