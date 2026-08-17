import { Paper, SxProps, Typography } from '@mui/material';

const paperProps = { p: 2, m: 'auto', width: 'calc(100% - 32px)' } as SxProps;

// Long, translated messages (e.g. prerequisite/noClauses) must wrap and stay
// inside the Paper rather than overflow it — this was the TT-7505 fix, now
// shared across every BOLD-clause step (Careful Speech, LWC Translation,
// Careful/LWC Transcription) so all their empty-state messages render alike.
const messageSx = {
  overflowWrap: 'break-word',
  whiteSpace: 'normal',
} as SxProps;

interface Props {
  message: string;
}

/**
 * Centered empty-state / prerequisite message shown when a BOLD-clause step
 * cannot render its editor yet (no audio, no clauses, prerequisite step
 * incomplete, etc.).
 */
export default function StepMessage({ message }: Props) {
  return (
    <Paper sx={paperProps}>
      <Typography variant="h5" align="center" sx={messageSx}>
        {message}
      </Typography>
    </Paper>
  );
}
