import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import ForumIcon from '@mui/icons-material/Forum';
import { LightTooltip } from '../../control/LightTooltip';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useDiscussionCount } from '../../crud/useDiscussionCount';
import { discussionListSelector } from '../../selector';
import { useMobile } from '../../utils/useMobile';
import {
  documentHasVerticalScrollbar,
  measureScrollbarWidth,
} from '../../utils/getScrollbarWidth';

export default function DiscussionPanel() {
  const { isMobileWidth } = useMobile();
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
  const [windowWidth, setWindowWidth] = useState(
    typeof window === 'undefined' ? discussionSize.width : window.innerWidth
  );
  const [scrollbarWidth, setScrollbarWidth] = useState(0);
  const cachedScrollbarWidthRef = useRef(0);
  useLayoutEffect(() => {
    if (typeof document !== 'undefined') {
      cachedScrollbarWidthRef.current = measureScrollbarWidth();
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateLayout = () => {
      setWindowWidth(window.innerWidth);
      setScrollbarWidth(
        documentHasVerticalScrollbar() ? cachedScrollbarWidthRef.current : 0
      );
    };
    updateLayout();
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  // Use viewport width (not mobile-view toggle) so desktop Mobile view side-by-side
  // keeps a fixed discussion column instead of width 100% over the waveform (TT-7373).
  const panelWidth = isMobileWidth
    ? Math.min(discussionSize.width, windowWidth)
    : Math.min(discussionSize.width, Math.max(0, windowWidth - scrollbarWidth));
  const getDiscussionCount = useDiscussionCount({
    mediafiles,
    discussions,
    groupmemberships,
  });
  const discussionCount = useMemo(
    () => getDiscussionCount(passage.id, currentstep, true),
    [passage.id, currentstep, getDiscussionCount]
  );

  const discussionFab = (
    <LightTooltip title={t.open}>
      <Fab
        aria-label={t.open}
        sx={{
          p: 3.5,
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'divider',
          backgroundColor: 'background.paper',
          color: 'custom.black',
        }}
        onClick={() => setDiscussOpen(true)}
      >
        <Badge
          badgeContent={discussionCount}
          color="primary"
          // Make the badge pill smaller than the default size
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.7rem',
              height: '1.5em',
              minWidth: '1.5em',
              lineHeight: '1.5em',
              padding: '0 0.35em',
              borderRadius: '1em',
            },
          }}
        >
          <ForumIcon />
        </Badge>
      </Fab>
    </LightTooltip>
  );

  return (
    Boolean(mediafileId) &&
    (discussOpen ? (
      <Grid
        size={{ xs: 12 }}
        container
        sx={{
          // Narrow viewport: fill parent. Wide (incl. mobile-view toggle): fixed panelWidth.
          width: isMobileWidth ? '100%' : panelWidth,
          maxWidth: '100%',
          minWidth: 0,
          boxSizing: 'border-box',
          justifyContent: 'center',
          ...(isMobileWidth
            ? {}
            : {
                marginRight: `${scrollbarWidth}px`,
              }),
        }}
      >
        <Grid container direction="column" sx={{ minWidth: 0, width: '100%' }}>
          <DiscussionList onClose={() => setDiscussOpen(false)} />
        </Grid>
      </Grid>
    ) : (
      <Box
        data-cy="discussion-fab"
        sx={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          p: 1.5,
          zIndex: (theme) => theme.zIndex.fab,
        }}
      >
        {discussionFab}
      </Box>
    ))
  );
}
