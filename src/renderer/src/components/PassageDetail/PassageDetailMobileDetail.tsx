import { Box, Paper, Stack, SxProps, Typography } from '@mui/material';
import { useEffect, useMemo } from 'react';
import DiscussionPanel from '../../components/Discussions/DiscussionPanel';
import PassageDetailLayout from './PassageDetailLayout';
import MobileWorkflowSteps from './mobile/MobileWorkflowSteps';
import PassageDetailMobileFooter from './mobile/PassageDetailMobileFooter';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import { useStepTool, ToolSlug } from '../../crud';
import { useRole } from '../../crud/useRole';
import { useStepPermissions } from '../../utils/useStepPermission';

interface Props {
  /** When true, show the no-audio message instead of step content (Discuss, playback, etc.). */
  showNoAudioPlaceholder: boolean;
  showSideBySide: boolean;
  flushDiscussionLeft?: boolean;
  recordContent: React.ReactNode;
  noAudioText: string;
}

const paperProps = { p: 2, m: 'auto', width: `calc(100% - 40px)` } as SxProps;

export default function PassageDetailMobileDetail({
  showNoAudioPlaceholder,
  showSideBySide,
  flushDiscussionLeft,
  recordContent,
  noAudioText,
}: Props) {
  const {
    currentstep,
    section,
    discussionSize,
    promptDockedRecordButton,
    promptDockedRecordFooterVersion,
    setDiscussOpen,
  } = usePassageDetailContext();
  const { tool } = useStepTool(currentstep);
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
      header={<MobileWorkflowSteps />}
      headerSx={{
        backgroundColor: 'custom.headerBackground',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
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
      {!showNoAudioPlaceholder ? (
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
      ) : (
        <Paper sx={paperProps}>
          <Typography variant="h2" align="center">
            {noAudioText}
          </Typography>
        </Paper>
      )}
    </PassageDetailLayout>
  );
}
