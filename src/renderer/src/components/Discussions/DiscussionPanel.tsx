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
import { useMobile } from '../../utils/useMobile';

/** Sits just above PassageDetailMobileLayout footer: border + pt + compact row + pb + safe area, plus small gap. */
const discussionFabBottomDetailMobile =
  'calc(8px + 1px + 4px + 40px + 2px + env(safe-area-inset-bottom, 0px))';

export default function DiscussionPanel() {
  const { isMobile } = useMobile();
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
          // Mobile content area is narrower than window (layout padding); fill parent, don’t use innerWidth.
          width: isMobile ? '100%' : panelWidth,
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          justifyContent: 'center',
        }}
      >
        <Grid container direction="column" sx={{ minWidth: 0, width: '100%' }}>
          <DiscussionList onClose={() => setDiscussOpen(false)} />
        </Grid>
      </Grid>
    ) : (
      <Box
        sx={{
          position: 'fixed',
          bottom: isDetail
            ? isMobile
              ? discussionFabBottomDetailMobile
              : 50
            : 10,
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
