import { Box, Paper, Stack, SxProps, Typography } from '@mui/material';
import { useMemo } from 'react';
import DiscussionPanel from '../../components/Discussions/DiscussionPanel';
import PassageDetailMobileLayout from './PassageDetailMobileLayout';
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
  } = usePassageDetailContext();
  const { tool } = useStepTool(currentstep);
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

  return (
    <PassageDetailMobileLayout
      header={<MobileWorkflowSteps />}
      footer={<PassageDetailMobileFooter />}
      footerAbove={promptRecordFooter}
      contentSx={contentSx}
    >
      {!showNoAudioPlaceholder ? (
        <>
          {showSideBySide ? (
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
              <Box sx={{ width: '100%', minWidth: 0 }}>
                <DiscussionPanel />
              </Box>
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
    </PassageDetailMobileLayout>
  );
}
