import {
  useCallback,
  useContext,
  useEffect,
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
import { Badge, Box, Drawer, Fab } from '@mui/material';
import PassageDetailPlayer from '../PassageDetail/PassageDetailPlayer';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import DiscussionList from './DiscussionList';
import ForumIcon from '@mui/icons-material/Forum';
import { LightTooltip } from '../../control/LightTooltip';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useDiscussionCount } from '../../crud/useDiscussionCount';
import { discussionListSelector } from '../../selector';

const MAX_DRAWER_WIDTH_RATIO = 0.95;

export default function DiscussionPanel() {
  const ctx = useContext(PassageDetailContext);
  const {
    discussionSize,
    mediafileId,
    discussOpen,
    passage,
    currentstep,
    setDiscussOpen,
    setPlaying,
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
  // The drawer's player keeps its own play state so it doesn't also start the
  // step's player underneath, which reads the shared context `playing`.
  const [miniPlaying, setMiniPlaying] = useState(false);
  // Unsaved edits in the list; a backdrop click or Escape must not discard them.
  const dirtyRef = useRef(false);
  const handleDirtyChange = useCallback((dirty: boolean) => {
    dirtyRef.current = dirty;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateWidth = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const openDrawer = () => {
    // The step's player is covered by the backdrop; stop it so only the
    // drawer's player is heard.
    setPlaying(false);
    setDiscussOpen(true);
  };

  const closeDrawer = () => {
    setMiniPlaying(false);
    setDiscussOpen(false);
  };

  const panelWidth = Math.min(
    discussionSize.width,
    Math.floor(windowWidth * MAX_DRAWER_WIDTH_RATIO)
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
        onClick={openDrawer}
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
    Boolean(mediafileId) && (
      <>
        {!discussOpen && (
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
        )}
        <Drawer
          anchor="right"
          open={discussOpen}
          onClose={() => {
            if (!dirtyRef.current) closeDrawer();
          }}
          slotProps={{
            paper: {
              sx: { width: panelWidth, overflow: 'hidden' },
            },
          }}
        >
          {discussOpen && (
            <DiscussionList
              onClose={closeDrawer}
              onDirtyChange={handleDirtyChange}
              player={
                <Box data-cy="discussion-mini-player" sx={{ px: 1, pb: 1 }}>
                  <PassageDetailPlayer
                    width={panelWidth - 16}
                    playing={miniPlaying}
                    setPlayingOverride={setMiniPlaying}
                    // The step's player keeps the hotkeys: the hotkey registry
                    // holds one handler per key, so claiming them here would
                    // drop the step player's when the drawer closes.
                    hotkeys={false}
                    showTranscriptionButton={false}
                  />
                </Box>
              }
            />
          )}
        </Drawer>
      </>
    )
  );
}
