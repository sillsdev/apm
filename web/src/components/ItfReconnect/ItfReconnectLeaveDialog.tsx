import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
} from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { Button } from '../../control/Button';
import { importSelector, sharedSelector } from '../../selector';

interface IProps {
  /** False once the server is applying the ITF: only waiting is left. */
  canStop: boolean;
  onStay: () => void;
  onStopAndLeave: () => void;
}

/**
 * TT-7911: shown when the user leaves a project (switch or logout) while the
 * reconnect ITF is still running, like the Upload Pending leave gate. The
 * leave goes ahead by itself once the ITF finishes.
 */
export function ItfReconnectLeaveDialog(props: Readonly<IProps>) {
  const { canStop, onStay, onStopAndLeave } = props;
  const t = useSelector(importSelector, shallowEqual);
  const ts = useSelector(sharedSelector, shallowEqual);

  return (
    <Dialog
      id="itfReconnectLeave"
      open
      onClose={onStay}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>{t.importSyncUp}</DialogTitle>
      <DialogContent>
        <DialogContentText>{t.itfReconnectLeaveWait}</DialogContentText>
        <LinearProgress sx={{ mt: 2 }} />
      </DialogContent>
      <DialogActions>
        <Button id="itfReconnectStay" onClick={onStay}>
          {ts.cancel}
        </Button>
        <Button
          id="itfReconnectStopAndLeave"
          variant="contained"
          disabled={!canStop}
          onClick={onStopAndLeave}
        >
          {t.itfReconnectStopAndLeave}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
