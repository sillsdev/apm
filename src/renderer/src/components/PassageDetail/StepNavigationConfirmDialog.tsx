import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { ISharedStrings, IWorkflowStepsStrings } from '../../model';
import { sharedSelector, workflowStepsSelector } from '../../selector';
import { Button } from '../../control';

interface IProps {
  open: boolean;
  message: string;
  onCancel: () => void;
  onComplete: () => void;
  onContinue: () => void;
}

export default function StepNavigationConfirmDialog({
  open,
  message,
  onCancel,
  onComplete,
  onContinue,
}: IProps) {
  const workflowStrings: IWorkflowStepsStrings = useSelector(
    workflowStepsSelector,
    shallowEqual
  );
  const sharedStrings: ISharedStrings = useSelector(
    sharedSelector,
    shallowEqual
  );
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
