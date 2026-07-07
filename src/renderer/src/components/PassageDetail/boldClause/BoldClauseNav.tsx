import { Box, CircularProgress, IconButton, Typography } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';

export interface BoldClauseNavStrings {
  clauseIndex: string;
  progress: string;
}

interface Props {
  currentIndex: number;
  totalClauses: number;
  completedCount: number;
  currentClauseComplete: boolean;
  navigationDisabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  strings: BoldClauseNavStrings;
  dataCy?: string;
  prevId?: string;
  nextId?: string;
}

const PROGRESS_SIZE = 40;

export default function BoldClauseNav({
  currentIndex,
  totalClauses,
  completedCount,
  currentClauseComplete,
  navigationDisabled,
  onPrev,
  onNext,
  strings,
  dataCy = 'bold-clause-nav',
  prevId = 'bold-clause-prev',
  nextId = 'bold-clause-next',
}: Props) {
  if (totalClauses === 0) return null;

  const progressValue =
    totalClauses > 0 ? (completedCount / totalClauses) * 100 : 0;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        py: 1,
        px: 1,
        width: '100%',
        maxWidth: '100%',
        minWidth: 0,
        flexWrap: 'wrap',
      }}
      data-cy={dataCy}
    >
      <IconButton
        id={prevId}
        aria-label="Previous clause"
        disabled={navigationDisabled || currentIndex === 0}
        onClick={onPrev}
        size="small"
      >
        <ChevronLeft />
      </IconButton>
      <Typography variant="body2" component="span" data-cy="bold-clause-label">
        {strings.clauseIndex
          .replace('{0}', String(currentIndex + 1))
          .replace('{1}', String(totalClauses))}
      </Typography>
      <IconButton
        id={nextId}
        aria-label="Next clause"
        disabled={navigationDisabled || currentIndex >= totalClauses - 1}
        onClick={onNext}
        size="small"
        sx={
          currentClauseComplete
            ? { color: 'primary.main', bgcolor: 'action.selected' }
            : undefined
        }
      >
        <ChevronRight />
      </IconButton>
      <Box
        component="span"
        data-cy="bold-clause-progress"
        sx={{
          ml: 1,
          position: 'relative',
          display: 'inline-flex',
          flexShrink: 0,
        }}
        aria-label={strings.progress
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
    </Box>
  );
}
