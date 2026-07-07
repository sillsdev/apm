import { Box, CircularProgress, IconButton, Typography } from '@mui/material';
import ChevronLeft from '@mui/icons-material/ChevronLeft';
import ChevronRight from '@mui/icons-material/ChevronRight';
import { ILwcTranslationStrings } from '@model/index';
import { shallowEqual, useSelector } from 'react-redux';
import { lwcTranslationSelector } from '../../../selector';

interface Props {
  currentIndex: number;
  totalClauses: number;
  completedCount: number;
  currentClauseRecorded: boolean;
  navigationDisabled: boolean;
  onPrev: () => void;
  onNext: () => void;
}

const PROGRESS_SIZE = 40;

export default function LwcTranslationClauseNav({
  currentIndex,
  totalClauses,
  completedCount,
  currentClauseRecorded,
  navigationDisabled,
  onPrev,
  onNext,
}: Props) {
  const t: ILwcTranslationStrings = useSelector(
    lwcTranslationSelector,
    shallowEqual
  );

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
      }}
      data-cy="lwc-clause-nav"
    >
      <IconButton
        id="lwc-clause-prev"
        aria-label="Previous clause"
        disabled={navigationDisabled || currentIndex === 0}
        onClick={onPrev}
        size="small"
      >
        <ChevronLeft />
      </IconButton>
      <Typography variant="body2" component="span" data-cy="lwc-clause-label">
        {t.clauseIndex
          .replace('{0}', String(currentIndex + 1))
          .replace('{1}', String(totalClauses))}
      </Typography>
      <IconButton
        id="lwc-clause-next"
        aria-label="Next clause"
        disabled={navigationDisabled || currentIndex >= totalClauses - 1}
        onClick={onNext}
        size="small"
        sx={
          currentClauseRecorded
            ? { color: 'primary.main', bgcolor: 'action.selected' }
            : undefined
        }
      >
        <ChevronRight />
      </IconButton>
      <Box
        component="span"
        data-cy="lwc-clause-progress"
        sx={{
          ml: 1,
          position: 'relative',
          display: 'inline-flex',
          flexShrink: 0,
        }}
        aria-label={t.progress
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
