import { Box, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { Button } from '../control';
import { ISharedStrings, IWsAudioPlayerStrings } from '../model';
import { sharedSelector, wsAudioPlayerSelector } from '../selector';
import AiTimeProgress from './AiTimeProgress';

interface AiProcessingProps {
  startedAt: number;
  estimateSec: number;
  onCancel: () => void;
}

/** Shown in place of a player while an AI request runs. */
export function AiProcessing({
  startedAt,
  estimateSec,
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
        px: 2,
        py: 1,
      }}
    >
      <Typography sx={{ textAlign: 'center', overflowWrap: 'break-word' }}>
        {t.aiInProgress}
      </Typography>
      <AiTimeProgress
        estimateSec={estimateSec}
        startedAt={startedAt}
        textId="ai-time-estimate"
      />
      <Button id="ai-cancel" onClick={onCancel}>
        {ts.cancel}
      </Button>
    </Box>
  );
}
