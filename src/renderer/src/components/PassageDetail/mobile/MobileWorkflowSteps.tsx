import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Menu,
  MenuItem,
  Typography,
  useTheme,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { useGetGlobal } from '../../../context/useGlobal';
import { useSnackBar } from '../../../hoc/SnackBar';
import { sharedSelector, workflowStepsSelector } from '../../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { useWfLabel } from '../../../utils/useWfLabel';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IWorkflowStepsStrings } from '../../../model';
import { toCamel } from '../../../utils/toCamel';

const mockPassages = [
  'Passage 1',
  'Passage 2',
  'Passage 3',
  'Passage 4',
  'Passage 5',
  'Passage 6',
  'Passage 7',
  'Passage 8',
];

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
  const [passageMenuAnchor, setPassageMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [passageRef, setPassageRef] = useState(mockPassages[0]);

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

  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownWidth, setDropdownWidth] = useState(0);

  useLayoutEffect(() => {
    const el = dropdownRef.current;
    if (!el) return;
    const update = () => {
      const style = window.getComputedStyle(el);
      setDropdownWidth(el.offsetWidth + parseFloat(style.marginRight));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const didMountRef = useRef(false);
  const stepRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    const el = stepRefs.current.get(currentstep);
    if (!el) {
      return;
    }
    el.scrollIntoView({
      behavior: didMountRef.current ? 'smooth' : 'auto',
      block: 'nearest',
      inline: 'center',
    });
    didMountRef.current = true;
  }, [currentstep, workflow.length]);

  return (
    <Box sx={{ px: 1.5, py: 1 }} data-cy="workflow-steps">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          width: '100%',
        }}
      >
        <Box ref={dropdownRef} sx={{ flexShrink: 0, mr: 1 }}>
          <Button
            size="small"
            endIcon={<ArrowDropDownIcon />}
            sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
            onClick={(e) => setPassageMenuAnchor(e.currentTarget)}
            data-cy="passage-dropdown"
          >
            {passageRef}
          </Button>
          <Menu
            anchorEl={passageMenuAnchor}
            open={Boolean(passageMenuAnchor)}
            onClose={() => setPassageMenuAnchor(null)}
          >
            {mockPassages.map((p) => (
              <MenuItem
                key={p}
                selected={p === passageRef}
                onClick={() => {
                  setPassageRef(p);
                  setPassageMenuAnchor(null);
                }}
              >
                {p}
              </MenuItem>
            ))}
          </Menu>
        </Box>
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            overflowX: 'auto',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <Box sx={{ display: 'flex', mx: 'auto', pb: 0.25 }}>
            {workflow.map((step) => {
              const isCurrent = step.id === currentstep;
              return (
                <ButtonBase
                  key={step.id}
                  data-cy="workflow-step"
                  role="button"
                  onClick={handleSelect(step.id)}
                  tabIndex={0}
                  ref={(el) => {
                    if (el) {
                      stepRefs.current.set(step.id, el);
                    } else {
                      stepRefs.current.delete(step.id);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                    }
                  }}
                  sx={{
                    flex: '0 0 80px',
                    height: 30,
                    mr: -0.25,
                    backgroundColor: isCurrent
                      ? theme.palette.grey[700]
                      : stepComplete(step.id)
                        ? theme.palette.grey[400]
                        : theme.palette.grey[200],
                    clipPath: 'polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)',
                    cursor:
                      recording || commentRecording ? 'not-allowed' : 'pointer',
                  }}
                />
              );
            })}
            <Box sx={{ flexShrink: 0, width: dropdownWidth }} />
          </Box>
        </Box>
      </Box>
      {currentLabel && (
        <Typography
          sx={{ mt: 1, textAlign: 'center' }}
          data-cy="workflow-step-label"
        >
          {currentTip ? (
            <ButtonBase
              onClick={() => setTipOpen(true)}
              data-cy="workflow-step-tip"
              sx={{
                borderRadius: 1,
                fontWeight: 'inherit',
                fontSize: 'inherit',
              }}
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
