import { Box, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { Button } from '../control';
import { ISharedStrings, IWsAudioPlayerStrings } from '../model';
import { sharedSelector, wsAudioPlayerSelector } from '../selector';
import type { AiProgress } from '../utils/useAudioConversion';
import AiTimeProgress from './AiTimeProgress';

interface AiProcessingProps extends Partial<AiProgress> {
  /** Defaults to the AI-in-progress notice. */
  message?: string;
  onCancel: () => void;
}

/**
 * Shown in place of a player while an AI request runs. Keep it outside any
 * fixed-height `overflow: hidden` box: its text wraps on narrow screens, and a
 * clipped box hid Cancel on mobile (TT-7791).
 */
export function AiProcessing({
  startedAt,
  estimateSec,
  message,
  onCancel,
}: AiProcessingProps) {
  const t: IWsAudioPlayerStrings = useSelector(
    wsAudioPlayerSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        px: 2,
        py: 1,
      }}
    >
      <Typography
        sx={{
          textAlign: 'center',
          width: '100%',
          overflowWrap: 'break-word',
        }}
      >
        {message ?? t.aiInProgress}
      </Typography>
      {startedAt !== undefined && (
        <AiTimeProgress
          estimateSec={estimateSec}
          startedAt={startedAt}
          textId="ai-time-estimate"
        />
      )}
      <Button id="ai-cancel" onClick={onCancel}>
        {ts.cancel}
      </Button>
    </Box>
  );
}
