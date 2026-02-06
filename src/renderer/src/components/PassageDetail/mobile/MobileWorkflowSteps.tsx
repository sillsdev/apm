import { Box, Typography, useTheme } from '@mui/material';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { useGetGlobal } from '../../../context/useGlobal';
import { useSnackBar } from '../../../hoc/SnackBar';
import { sharedSelector } from '../../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { useWfLabel } from '../../../utils/useWfLabel';

export default function MobileWorkflowSteps() {
  const { workflow, currentstep, setCurrentStep, recording, commentRecording } =
    usePassageDetailContext();
  const getGlobal = useGetGlobal();
  const { showMessage } = useSnackBar();
  const ts = useSelector(sharedSelector, shallowEqual);
  const theme = useTheme();
  const getWfLabel = useWfLabel();

  const handleSelect = (id: string) => () => {
    if (getGlobal('remoteBusy')) {
      showMessage(ts.wait);
      return;
    }
    if (!recording && !commentRecording && id !== currentstep) {
      setCurrentStep(id);
    }
  };

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
            <Box
              key={step.id}
              data-cy="workflow-step"
              onClick={handleSelect(step.id)}
              sx={{
                width: 36,
                height: 14,
                backgroundColor: isCurrent
                  ? theme.palette.grey[600]
                  : theme.palette.grey[300],
                transform: 'skewX(-20deg)',
                borderRadius: '2px',
                cursor:
                  recording || commentRecording ? 'not-allowed' : 'pointer',
                flexShrink: 0,
              }}
            >
              <Box
                sx={{
                  width: '100%',
                  height: '100%',
                  transform: 'skewX(20deg)',
                }}
              />
            </Box>
          );
        })}
      </Box>
      {workflow.find((w) => w.id === currentstep)?.label && (
        <Typography
          variant="caption"
          sx={{ display: 'block', textAlign: 'center' }}
          data-cy="workflow-step-label"
        >
          {getWfLabel(workflow.find((w) => w.id === currentstep)?.label ?? '')}
        </Typography>
      )}
    </Box>
  );
}
