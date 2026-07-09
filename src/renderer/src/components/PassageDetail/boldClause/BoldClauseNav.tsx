import { Box, IconButton, Typography } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';

export interface BoldClauseNavStrings {
  clauseIndex: string;
}

interface Props {
  currentIndex: number;
  totalClauses: number;
  currentClauseComplete: boolean;
  navigationDisabled: boolean;
  onPrev: () => void;
  onNext: () => void;
  strings: BoldClauseNavStrings;
  dataCy?: string;
  prevId?: string;
  nextId?: string;
}

export default function BoldClauseNav({
  currentIndex,
  totalClauses,
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
    </Box>
  );
}
