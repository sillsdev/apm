import { Box, LinearProgress, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { formatTime } from '../control/formatTime';
import { IWsAudioPlayerStrings } from '../model';
import { wsAudioPlayerSelector } from '../selector';
import { useAiProgress } from '../utils/useAiProgress';

interface AiTimeProgressProps {
  /** Undefined when there's nothing to estimate from: show elapsed time only. */
  estimateSec?: number;
  startedAt: number;
  /** id of the text line, for tests. */
  textId: string;
}

/** TT-6276: progress bar and countdown for a running AI request. */
export default function AiTimeProgress({
  estimateSec,
  startedAt,
  textId,
}: AiTimeProgressProps) {
  const t: IWsAudioPlayerStrings = useSelector(
    wsAudioPlayerSelector,
    shallowEqual
  );
  const progress = useAiProgress(estimateSec, startedAt);

  const text = () => {
    const elapsed = formatTime(Math.floor(progress.elapsedSec));
    switch (progress.status) {
      case 'estimating':
        return t.aiTimeRemaining.replace(
          '{0}',
          formatTime(progress.remainingSec)
        );
      case 'overrun':
        return t.aiTakingLonger.replace('{0}', elapsed);
      case 'unknown':
        return elapsed;
    }
  };

  return (
    <Box sx={{ width: '100%' }}>
      {progress.status === 'estimating' ? (
        <LinearProgress variant="determinate" value={progress.fraction * 100} />
      ) : (
        <LinearProgress />
      )}
      <Typography id={textId} sx={{ textAlign: 'center' }}>
        {text()}
      </Typography>
    </Box>
  );
}
