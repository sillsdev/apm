import { Box, LinearProgress, Paper, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { Button } from '../../control/Button';
import { importSelector, sharedSelector } from '../../selector';
import {
  canCancelItf,
  isItfRunning,
  type ItfReconnectStatus as Status,
} from '../../utils/itfReconnect';

interface IProps {
  status: Exclude<Status, 'idle'>;
  onCancel: () => void;
  onRetry: () => void;
  onClose: () => void;
}

const panelSx = {
  position: 'fixed',
  left: 16,
  bottom: 16,
  zIndex: 'snackbar',
  p: 2,
  maxWidth: 420,
} as const;

/**
 * TT-7911: progress of the ITF sent when the connection comes back. It does
 * not block the page (the user keeps working); only leaving the project waits
 * for it (ItfReconnectLeaveDialog).
 */
export function ItfReconnectStatus(props: Readonly<IProps>) {
  const { status, onCancel, onRetry, onClose } = props;
  const t = useSelector(importSelector, shallowEqual);
  const ts = useSelector(sharedSelector, shallowEqual);

  if (isItfRunning(status)) {
    return (
      <Paper id="itfReconnectStatus" role="status" elevation={6} sx={panelSx}>
        <Typography>
          {status === 'applying' ? t.importPending : t.importSyncUp}
        </Typography>
        <LinearProgress sx={{ my: 1 }} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            id="itfReconnectCancel"
            disabled={!canCancelItf(status)}
            onClick={onCancel}
          >
            {ts.cancel}
          </Button>
        </Box>
      </Paper>
    );
  }

  const message: Record<'sent' | 'cancelled' | 'failed', string> = {
    sent: t.itfReconnectSent,
    cancelled: t.itfReconnectCancelled,
    failed: t.itfReconnectFailed,
  };
  return (
    <Paper id="itfReconnectStatus" role="status" elevation={6} sx={panelSx}>
      <Typography color={status === 'failed' ? 'error' : undefined}>
        {message[status]}
      </Typography>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
        {status !== 'sent' && (
          <Button id="itfReconnectRetry" onClick={onRetry}>
            {t.itfReconnectRetry}
          </Button>
        )}
        <Button id="itfReconnectClose" onClick={onClose}>
          {ts.close}
        </Button>
      </Box>
    </Paper>
  );
}
