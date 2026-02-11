import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
  useTheme,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { useGetGlobal } from '../../../context/useGlobal';
import { useSnackBar } from '../../../hoc/SnackBar';
import { sharedSelector, workflowStepsSelector } from '../../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { useWfLabel } from '../../../utils/useWfLabel';
import { useMemo, useState } from 'react';
import { IWorkflowStepsStrings } from '../../../model';
import { toCamel } from '../../../utils/toCamel';

export default function MobileWorkflowSteps() {
  const {
    workflow,
    currentstep,
    setCurrentStep,
    recording,
    commentRecording,
    stepComplete,
  } = usePassageDetailContext();
  const getGlobal = useGetGlobal();
  const { showMessage } = useSnackBar();
  const ts = useSelector(sharedSelector, shallowEqual);
  const theme = useTheme();
  const getWfLabel = useWfLabel();
  const t: IWorkflowStepsStrings = useSelector(
    workflowStepsSelector,
    shallowEqual
  );
  const [tipOpen, setTipOpen] = useState(false);

  const handleSelect = (id: string) => () => {
    if (getGlobal('remoteBusy')) {
      showMessage(ts.wait);
      return;
    }
    if (!recording && !commentRecording && id !== currentstep) {
      setCurrentStep(id);
    }
  };

  const currentLabel = useMemo(() => {
    return workflow.find((w) => w.id === currentstep)?.label ?? '';
  }, [currentstep, workflow]);
  const currentTip = useMemo(() => {
    if (!currentLabel) {
      return '';
    }
    const tipKey = toCamel(currentLabel + 'Tip');
    return Object.prototype.hasOwnProperty.call(t, tipKey)
      ? t.getString(tipKey)
      : '';
  }, [currentLabel, t]);

  return (
    <Box sx={{ px: 1.5, py: 0.5 }} data-cy="workflow-steps">
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          gap: 0.75,
          overflowX: 'hidden',
          pb: 0.25,
        }}
      >
        {workflow.map((step) => {
          const isCurrent = step.id === currentstep;
          return (
            <ButtonBase
              key={step.id}
              data-cy="workflow-step"
              role="button"
              onClick={handleSelect(step.id)}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                }
              }}
              sx={{
                width: 36,
                height: 14,
                backgroundColor: isCurrent
                  ? theme.palette.grey[700]
                  : stepComplete(step.id)
                    ? theme.palette.grey[400]
                    : theme.palette.grey[200],
                transform: 'skewX(-20deg)',
                borderRadius: '2px',
                cursor:
                  recording || commentRecording ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
            />
          );
        })}
      </Box>
      {currentLabel && (
        <Typography
          variant="caption"
          sx={{ display: 'block', textAlign: 'center' }}
          data-cy="workflow-step-label"
        >
          {currentTip ? (
            <ButtonBase
              onClick={() => setTipOpen(true)}
              data-cy="workflow-step-tip"
              sx={{ borderRadius: 1 }}
              aria-label={currentTip}
            >
              {getWfLabel(currentLabel) + '\u00A0'}
              <InfoIcon color={'info'} fontSize="small" />
            </ButtonBase>
          ) : (
            getWfLabel(currentLabel)
          )}
        </Typography>
      )}
      <Dialog open={tipOpen} onClose={() => setTipOpen(false)}>
        <DialogTitle>{getWfLabel(currentLabel)}</DialogTitle>
        <DialogContent>{currentTip}</DialogContent>
        <DialogActions>
          <Button onClick={() => setTipOpen(false)}>{ts.close}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
