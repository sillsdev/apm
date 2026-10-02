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
  showSideBySide: areDiscussionsSideBySide,
  flushDiscussionLeft,
  recordContent,
}: Props) {
  const {
    currentstep,
    section,
    mediafileId,
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
  const doesStepSupportDiscussions = tool !== ToolSlug.Resource;
  const contentSx = useMemo(
    () => ({
      ...(flushDiscussionLeft ? { pl: 0 } : {}),
    }),
    [flushDiscussionLeft]
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
        pb: 1.5,
        ...contentSx,
      }}
    >
      {!isWaitingForAudio ? (
        <>
          {areDiscussionsSideBySide && doesStepSupportDiscussions ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 5,
                pt: 1.5,
                width: '100%',
                minWidth: 0,
                overflow: 'clip',
              }}
              data-cy="discussion-side-by-side"
            >
              <Box sx={{ flex: 1, minWidth: 0, overflow: 'clip' }}>
                {recordContent}
              </Box>
              <Box
                sx={{
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
                pt: 1.5,
                width: '100%',
                maxWidth: '100%',
                minWidth: 0,
                overflowX: 'clip',
              }}
            >
              <Box
                sx={
                  flushDiscussionLeft
                    ? { display: 'none' }
                    : { minWidth: 0, width: '100%' }
                }
              >
                {recordContent}
              </Box>
              {doesStepSupportDiscussions && (
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
        <Paper sx={{ p: 4, mt: 1.5 }}>
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
