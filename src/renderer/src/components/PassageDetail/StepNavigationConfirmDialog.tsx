import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { ISharedStrings, IWorkflowStepsStrings } from '../../model';

interface IProps {
  open: boolean;
  message: string;
  workflowStrings: IWorkflowStepsStrings;
  sharedStrings: ISharedStrings;
  onCancel: () => void;
  onComplete: () => void;
  onContinue: () => void;
}

export default function StepNavigationConfirmDialog({
  open,
  message,
  workflowStrings,
  sharedStrings,
  onCancel,
  onComplete,
  onContinue,
}: IProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="step-nav-confirm-title"
      aria-describedby="step-nav-confirm-desc"
      disableEnforceFocus
    >
      <DialogTitle id="step-nav-confirm-title">
        {workflowStrings.incompleteStepNavigateTitle}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="step-nav-confirm-desc">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>{sharedStrings.cancel}</Button>
        <Button onClick={onComplete} color="primary">
          {workflowStrings.incompleteStepComplete}
        </Button>
        <Button onClick={onContinue} color="primary" variant="contained">
          {workflowStrings.incompleteStepContinue}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
