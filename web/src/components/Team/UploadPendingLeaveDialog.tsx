/**
 * Two-step leave gate for web Upload Pending (ADR 0017 / step 05):
 * 1) prompt to upload all before leaving
 * 2) on decline, data-loss warning; confirm discards that project's Upload Pending
 * Cancel at either step keeps the Upload Pending.
 */
import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { Button } from '../../control/Button';
import { mediaTabSelector, sharedSelector } from '../../selector';

/**
 * `afterSwitch`: another project was opened without passing the gate (a
 * deep link or a reload into a different project), so the prompt is about the
 * previous project.
 */
export type UploadPendingLeaveReason = 'switch' | 'logout' | 'afterSwitch';

export type UploadPendingLeavePhase = 'prompt' | 'warn';

interface IProps {
  phase: UploadPendingLeavePhase;
  reason: UploadPendingLeaveReason;
  busy: boolean;
  /** False while offline: Upload all cannot succeed, so it is disabled. */
  canUpload: boolean;
  /** The last Upload all left some recordings Upload Pending. */
  uploadFailed: boolean;
  onUploadAll: () => void;
  onContinueWithoutUpload: () => void;
  onConfirmDiscard: () => void;
  onCancel: () => void;
}

export function UploadPendingLeaveDialog(props: Readonly<IProps>) {
  const {
    phase,
    reason,
    busy,
    canUpload,
    uploadFailed,
    onUploadAll,
    onContinueWithoutUpload,
    onConfirmDiscard,
    onCancel,
  } = props;
  const t = useSelector(mediaTabSelector, shallowEqual);
  const ts = useSelector(sharedSelector, shallowEqual);

  const promptText: Record<UploadPendingLeaveReason, string> = {
    switch: t.pendingUploadLeavePrompt,
    logout: t.pendingUploadLeaveLogoutPrompt,
    afterSwitch: t.pendingUploadLeaveAfterSwitchPrompt,
  };

  return (
    <Dialog open onClose={busy ? undefined : onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{t.pendingUploadTitle}</DialogTitle>
      <DialogContent>
        {phase === 'prompt' ? (
          <>
            <DialogContentText>{promptText[reason]}</DialogContentText>
            {!canUpload && (
              <DialogContentText sx={{ mt: 1 }}>
                {t.pendingUploadRetryLater}
              </DialogContentText>
            )}
            {uploadFailed && (
              <DialogContentText sx={{ mt: 1 }} color="error">
                {t.pendingUploadLeaveUploadFailed}
              </DialogContentText>
            )}
          </>
        ) : (
          <DialogContentText>{t.pendingUploadLeaveLossWarn}</DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onCancel}>
          {ts.cancel}
        </Button>
        {phase === 'prompt' ? (
          <>
            <Button disabled={busy} onClick={onContinueWithoutUpload}>
              {t.pendingUploadLeaveContinue}
            </Button>
            <Button
              variant="contained"
              disabled={busy || !canUpload}
              onClick={onUploadAll}
            >
              {t.pendingUploadLeaveUpload}
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            color="error"
            disabled={busy}
            onClick={onConfirmDiscard}
          >
            {ts.yes}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
