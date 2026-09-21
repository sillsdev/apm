import {
  Backdrop,
  Box,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import DiscussionPanel from '../../components/Discussions/DiscussionPanel';
import PassageDetailLayout from './PassageDetailLayout';
import MobileWorkflowSteps from './mobile/MobileWorkflowSteps';
import PassageDetailMobileFooter from './mobile/PassageDetailMobileFooter';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import {
  useStepTool,
  ToolSlug,
  toolAllowsEmptyVernacularAudio,
} from '../../crud';
import { useRole } from '../../crud/useRole';
import { useStepPermissions } from '../../utils/useStepPermission';
import { ISharedStrings } from '@model/index';
import { sharedSelector } from '../../selector';

interface Props {
  showSideBySide: boolean;
  flushDiscussionLeft?: boolean;
  recordContent: React.ReactNode;
}

const noAudioGraceMs = 5000;

export default function PassageDetailMobileDetail({
  showSideBySide,
  flushDiscussionLeft,
  recordContent,
}: Props) {
  const {
    currentstep,
    section,
    mediafileId,
    discussionSize,
    promptDockedRecordButton,
    promptDockedRecordFooterVersion,
    setDiscussOpen,
    hideMobileHeader,
    passage,
  } = usePassageDetailContext();
  const { tool } = useStepTool(currentstep);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const isWaitingForAudio = useMemo(() => {
    return !mediafileId && !toolAllowsEmptyVernacularAudio(tool);
  }, [mediafileId, tool]);
  const passageId = passage?.id;
  const [graceExpired, setGraceExpired] = useState(false);

  useEffect(() => {
    setGraceExpired(false);
    const timer = setTimeout(() => setGraceExpired(true), noAudioGraceMs);
    return () => clearTimeout(timer);
  }, [passageId, tool]);

  const showLoading = isWaitingForAudio && !graceExpired;
  // Desktop omits DiscussionPanel for Internalize (Resource); match that on mobile (TT-7281).
  const showDiscussion = tool !== ToolSlug.Resource;
  const markVersesLayout = tool === ToolSlug.Verses;
  const contentSx = useMemo(
    () => ({
      ...(flushDiscussionLeft ? { pl: 0 } : {}),
      ...(markVersesLayout
        ? {
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
            flex: 1,
            // Let the Mark Verses table grow and scroll inside this flex column
            '& > *': {
              flex: 1,
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            },
          }
        : {}),
    }),
    [flushDiscussionLeft, markVersesLayout]
  );
  const { userIsAdmin } = useRole();
  const { canDoSectionStep, permissionsOn } = useStepPermissions();
  const showPromptAdmin =
    userIsAdmin || (permissionsOn && canDoSectionStep(currentstep, section));
  const promptRecordFooter =
    tool === ToolSlug.Prompt &&
    showPromptAdmin &&
    promptDockedRecordButton != null ? (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          py: 0.5,
        }}
        data-cy="prompt-docked-record"
        key={promptDockedRecordFooterVersion}
      >
        {promptDockedRecordButton}
      </Box>
    ) : undefined;

  useEffect(() => {
    if (tool === ToolSlug.Resource) {
      setDiscussOpen(false);
    }
  }, [tool, setDiscussOpen]);

  return (
    <PassageDetailLayout
      header={hideMobileHeader ? null : <MobileWorkflowSteps />}
      headerSx={
        hideMobileHeader
          ? undefined
          : {
              px: 1.5,
              pb: 1.5,
              backgroundColor: 'custom.headerBackground',
              borderBottom: '1px solid',
              borderColor: 'divider',
            }
      }
      footer={<PassageDetailMobileFooter />}
      footerSx={{
        backgroundColor: 'custom.headerBackground',
        borderTop: '1px solid',
        borderColor: 'divider',
        px: 1.5,
        py: 1,
      }}
      footerAbove={promptRecordFooter}
      footerAboveSx={{ backgroundColor: 'background.default', px: 1, py: 0.5 }}
      contentSx={{
        backgroundColor: 'background.default',
        px: 1.5,
        pt: 1.5,
        pb: 1.5,
        ...contentSx,
      }}
    >
      {!isWaitingForAudio ? (
        <>
          {showSideBySide && showDiscussion ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 5,
                width: '100%',
                minWidth: 0,
                overflow: 'hidden',
              }}
              data-cy="discussion-side-by-side"
            >
              <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                {recordContent}
              </Box>
              <Box
                sx={{
                  width: discussionSize.width,
                  flexShrink: 0,
                  minWidth: 0,
                  overflow: 'hidden',
                }}
                data-cy="discussion-side-column"
              >
                <DiscussionPanel />
              </Box>
            </Box>
          ) : (
            <Stack
              spacing={1}
              sx={{
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                overflowX: 'hidden',
              }}
            >
              <Box
                sx={
                  flushDiscussionLeft
                    ? { display: 'none' }
                    : markVersesLayout
                      ? {
                          flex: 1,
                          minHeight: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                          minWidth: 0,
                          width: '100%',
                        }
                      : { minWidth: 0, width: '100%' }
                }
              >
                {recordContent}
              </Box>
              {showDiscussion && (
                <Box sx={{ width: '100%', minWidth: 0 }}>
                  <DiscussionPanel />
                </Box>
              )}
            </Stack>
          )}
        </>
      ) : showLoading ? (
        <Backdrop
          open
          sx={{
            zIndex: (theme) => theme.zIndex.drawer + 1,
            position: 'absolute',
          }}
        >
          <CircularProgress color="inherit" size={50} />
        </Backdrop>
      ) : (
        <Paper sx={{ p: 4 }}>
          <Typography variant="h4" align="left">
            {ts.noAudio}
          </Typography>
          <Typography variant="h5" align="left" sx={{ py: 1 }}>
            {ts.loadError}
          </Typography>
        </Paper>
      )}
    </PassageDetailLayout>
  );
}
