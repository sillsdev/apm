import { IMainStrings } from '../model';
import {
  Dialog,
  DialogTitle,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { mainSelector } from '../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { Button } from '../control/Button';

interface TokenDialogProps {
  seconds: number;
  open: boolean;
  onClose: (value: number) => void;
}

function TokenDialog(props: TokenDialogProps) {
  const { seconds, onClose, open } = props;
  const t: IMainStrings = useSelector(mainSelector, shallowEqual);

  // A backdrop click or Escape must NOT be treated as a choice. Previously this
  // called onClose(-1) — the same as Exit — so an accidental dismiss (or a stray
  // click that landed on the modal backdrop) silently logged the user out in the
  // middle of their work. Ignore implicit dismissals; require an explicit
  // Continue or Exit.
  const handleClose = (_event: object, reason?: string) => {
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') return;
  };
  const handleExit = () => onClose(-1);
  const handleContinue = () => onClose(0);

  return (
    <Dialog
      onClose={handleClose}
      aria-labelledby="tokenDlg"
      open={open}
      disableEnforceFocus
      disableEscapeKeyDown
    >
      <DialogTitle id="tokenDlg">{t.sessionExpiring}</DialogTitle>
      <DialogContentText sx={{ px: 4 }}>
        {t.sessionExpireTask.replace('{0}', seconds.toString())}
      </DialogContentText>
      <DialogActions>
        <Button id="tokExit" variant="outlined" onClick={handleExit}>
          {t.exit}
        </Button>
        <Button id="tokCont" variant="contained" onClick={handleContinue}>
          {t.continue}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default TokenDialog;
