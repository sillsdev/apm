import { Box, Paper, Stack, SxProps, Typography } from '@mui/material';
import DiscussionPanel from '../../components/Discussions/DiscussionPanel';
import PassageDetailMobileLayout from './PassageDetailMobileLayout';
import MobileWorkflowSteps from './mobile/MobileWorkflowSteps';
import PassageDetailMobileFooter from './mobile/PassageDetailMobileFooter';

interface Props {
  currentVersion: number;
  showSideBySide: boolean;
  flushDiscussionLeft?: boolean;
  recordContent: React.ReactNode;
  noAudioText: string;
}

const paperProps = { p: 2, m: 'auto', width: `calc(100% - 40px)` } as SxProps;

export default function PassageDetailMobileDetail({
  currentVersion,
  showSideBySide,
  flushDiscussionLeft,
  recordContent,
  noAudioText,
}: Props) {
  return (
    <PassageDetailMobileLayout
      header={<MobileWorkflowSteps />}
      footer={<PassageDetailMobileFooter />}
      contentSx={flushDiscussionLeft ? { pl: 0 } : undefined}
    >
      {currentVersion !== 0 ? (
        <>
          {showSideBySide ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 5,
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>{recordContent}</Box>
              <Box sx={{ minWidth: 0 }}>
                <DiscussionPanel />
              </Box>
            </Box>
          ) : (
            <Stack spacing={1}>
              {recordContent}
              <DiscussionPanel />
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
