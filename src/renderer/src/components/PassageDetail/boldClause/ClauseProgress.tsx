import { Box, CircularProgress, SxProps, Theme, Typography } from '@mui/material';

interface Props {
  completedCount: number;
  totalClauses: number;
  /** aria-label template with `{0}` completed and `{1}` total placeholders. */
  progressLabel: string;
  /** Extra styling for the wrapper, e.g. absolute positioning over a player. */
  sx?: SxProps<Theme>;
}

const PROGRESS_SIZE = 40;

export default function ClauseProgress({
  completedCount,
  totalClauses,
  progressLabel,
  sx,
}: Props) {
  if (totalClauses === 0) return null;

  const progressValue =
    totalClauses > 0 ? (completedCount / totalClauses) * 100 : 0;

  return (
    <Box
      component="span"
      data-cy="bold-clause-progress"
      sx={{
        position: 'relative',
        display: 'inline-flex',
        flexShrink: 0,
        ...sx,
      }}
      aria-label={progressLabel
        .replace('{0}', String(completedCount))
        .replace('{1}', String(totalClauses))}
    >
      <CircularProgress
        variant="determinate"
        value={100}
        size={PROGRESS_SIZE}
        thickness={4}
        aria-hidden
        sx={{ color: 'grey.300' }}
      />
      <CircularProgress
        variant="determinate"
        value={progressValue}
        size={PROGRESS_SIZE}
        thickness={4}
        aria-hidden
        sx={{
          color: 'primary.main',
          position: 'absolute',
          left: 0,
        }}
      />
      <Box
        sx={{
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          position: 'absolute',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography
          variant="caption"
          component="span"
          sx={{ fontSize: '0.65rem', fontWeight: 600, lineHeight: 1 }}
        >
          {completedCount}/{totalClauses}
        </Typography>
      </Box>
    </Box>
  );
}
