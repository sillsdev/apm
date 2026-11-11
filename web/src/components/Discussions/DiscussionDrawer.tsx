import { useContext, useEffect, useMemo, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { Badge, Box, Drawer, Fab, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ForumIcon from '@mui/icons-material/Forum';
import {
  DiscussionD,
  GroupMembership,
  IDiscussionListStrings,
  ISharedStrings,
  MediaFileD,
} from '../../model';
import { PassageDetailContext } from '../../context/PassageDetailContext';
import { UnsavedContext } from '../../context/UnsavedContext';
import { discussionListSelector, sharedSelector } from '../../selector';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useDiscussionCount } from '../../crud/useDiscussionCount';
import { LightTooltip } from '../../control/LightTooltip';
import Confirm from '../AlertDialog';
import PassageDetailPlayer from '../PassageDetail/PassageDetailPlayer';
import DiscussionList, {
  actionButtonProps,
  NewDiscussionToolId,
} from './DiscussionList';

export default function DiscussionDrawer() {
  const ctx = useContext(PassageDetailContext);
  const {
    mediafileId,
    discussOpen,
    passage,
    currentstep,
    setDiscussOpen,
    setPlaying,
  } = ctx.state;
  const { toolsChanged, startClear } = useContext(UnsavedContext).state;
  const discussions = useOrbitData<DiscussionD[]>('discussion');
  const mediafiles = useOrbitData<MediaFileD[]>('mediafile');
  const groupmemberships = useOrbitData<GroupMembership[]>('groupmembership');
  const t: IDiscussionListStrings = useSelector(
    discussionListSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  // The drawer's player keeps its own play state so it doesn't also start the
  // step's player underneath, which reads the shared context `playing`.
  const [miniPlaying, setMiniPlaying] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const getDiscussionCount = useDiscussionCount({
    mediafiles,
    discussions,
    groupmemberships,
  });
  const discussionCount = useMemo(
    () => getDiscussionCount(passage.id, currentstep, true),
    [passage.id, currentstep, getDiscussionCount]
  );

  const unsentIds = useMemo(() => {
    const ids = new Set(discussions.map((d) => d.id));
    ids.add(NewDiscussionToolId);
    return Object.keys(toolsChanged).filter((id) => ids.has(id));
  }, [discussions, toolsChanged]);

  const openDrawer = () => {
    setPlaying(false);
    setDiscussOpen(true);
  };

  const closeDrawer = () => {
    setMiniPlaying(false);
    setDiscussOpen(false);
  };

  const requestClose = () => {
    if (unsentIds.length > 0) setConfirmClose(true);
    else closeDrawer();
  };

  const discardAndClose = () => {
    setConfirmClose(false);
    unsentIds.forEach((id) => startClear(id));
    setDiscarding(true);
  };

  useEffect(() => {
    if (discarding && unsentIds.length === 0) {
      setDiscarding(false);
      closeDrawer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [discarding, unsentIds]);

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
          onClose={requestClose}
          slotProps={{
            paper: {
              sx: {
                width: 450,
                maxWidth: '95vw',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              },
            },
          }}
        >
          {discussOpen && (
            <DiscussionList
              closeButton={
                <LightTooltip title={t.close}>
                  <IconButton
                    id="closeDiscussion"
                    sx={actionButtonProps}
                    onClick={requestClose}
                  >
                    <CloseIcon />
                  </IconButton>
                </LightTooltip>
              }
              player={
                <Box data-cy="discussion-mini-player" sx={{ px: 1, pb: 1 }}>
                  <PassageDetailPlayer
                    playing={miniPlaying}
                    setPlayingOverride={setMiniPlaying}
                    hotkeys={false}
                    showTranscriptionButton={false}
                  />
                </Box>
              }
            />
          )}
        </Drawer>
        {confirmClose && (
          <Confirm
            title={t.confirmCloseTitle}
            text={t.confirmClose}
            no={t.stayOpen}
            yes={ts.close}
            primaryButton="no"
            noResponse={() => setConfirmClose(false)}
            yesResponse={discardAndClose}
          />
        )}
      </>
    )
  );
}
