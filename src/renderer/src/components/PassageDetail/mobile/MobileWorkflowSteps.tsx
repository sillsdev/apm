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
import { useGetGlobal, useGlobal } from '../../../context/useGlobal';
import { useSnackBar } from '../../../hoc/SnackBar';
import { sharedSelector, workflowStepsSelector } from '../../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { useWfLabel } from '../../../utils/useWfLabel';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { IWorkflowStepsStrings, PassageD } from '../../../model';
import { toCamel } from '../../../utils/toCamel';
import { related } from '../../../crud/related';
import { findRecord } from '../../../crud/tryFindRecord';
import { rememberCurrentPassage } from '../../../utils';
import { usePassageNavigate } from '../usePassageNavigate';
import { isPublishingTitle } from '../../../control/passageTypeFromRef';
import {
  orgDefaultWorkflowProgression,
  useOrgDefaults,
} from '../../../crud/useOrgDefaults';

export default function MobileWorkflowSteps() {
  const {
    workflow,
    currentstep,
    setCurrentStep,
    recording,
    commentRecording,
    stepComplete,
    passage,
    section,
    prjId,
  } = usePassageDetailContext();
  const [memory] = useGlobal('memory');
  const passageNavigate = usePassageNavigate(() => {}, setCurrentStep);
  const getGlobal = useGetGlobal();
  const { showMessage } = useSnackBar();
  const ts = useSelector(sharedSelector, shallowEqual);
  const theme = useTheme();
  const getWfLabel = useWfLabel();
  const { getOrgDefault } = useOrgDefaults();
  const isStepProgression =
    getOrgDefault(orgDefaultWorkflowProgression) === 'step';
  const t: IWorkflowStepsStrings = useSelector(
    workflowStepsSelector,
    shallowEqual
  );
  const sectionPassages = useMemo<PassageD[]>(() => {
    const passRecIds = related(section, 'passages');
    if (!Array.isArray(passRecIds)) return [];
    return passRecIds
      .map((p) => findRecord(memory, 'passage', p.id) as PassageD)
      .filter(
        (p) => Boolean(p) && !isPublishingTitle(p?.attributes?.reference, false)
      )
      .sort((a, b) => a.attributes.sequencenum - b.attributes.sequencenum);
  }, [section, memory]);

  const [tipOpen, setTipOpen] = useState(false);
  const [passageMenuAnchor, setPassageMenuAnchor] =
    useState<HTMLElement | null>(null);

  const handleSelect = (id: string) => () => {
    if (getGlobal('remoteBusy')) {
      showMessage(ts.wait);
      return;
    }
    if (!recording && !commentRecording && id !== currentstep) {
      setCurrentStep(id);
    }
  };

  const currentLabel = useMemo(
    () => workflow.find((w) => w.id === currentstep)?.label ?? '',
    [currentstep, workflow]
  );
  const currentTip = useMemo(() => {
    if (!currentLabel) return '';
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
    const update = () =>
      setDropdownWidth(
        el.offsetWidth + parseFloat(window.getComputedStyle(el).marginRight)
      );
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const didMountRef = useRef(false);
  const stepRefs = useRef(new Map<string, HTMLElement>());

  useEffect(() => {
    const currentId = isStepProgression ? currentstep : (passage?.id ?? '');
    const el = stepRefs.current.get(currentId);
    if (!el) return;
    el.scrollIntoView({
      behavior: didMountRef.current ? 'smooth' : 'auto',
      block: 'nearest',
      inline: 'center',
    });
    didMountRef.current = true;
  }, [
    currentstep,
    passage?.id,
    workflow.length,
    sectionPassages.length,
    isStepProgression,
  ]);

  return (
    <Box sx={{ px: 1.5, py: 1 }} data-cy="workflow-steps">
      <Box
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          width: '100%',
        }}
      >
        {/* Passage dropdown */}
        <Box ref={dropdownRef} sx={{ flexShrink: 0, mr: 1 }}>
          <Button
            size="small"
            endIcon={<ArrowDropDownIcon />}
            sx={{ whiteSpace: 'nowrap', minWidth: 'auto' }}
            onClick={(e) => {
              if (recording || commentRecording) return;
              if (getGlobal('remoteBusy')) {
                showMessage(ts.wait);
                return;
              }
              setPassageMenuAnchor(e.currentTarget);
            }}
            data-cy="passage-dropdown"
          >
            {isStepProgression
              ? [passage?.attributes?.book, passage?.attributes?.reference]
                  .filter(Boolean)
                  .join(' ') || ''
              : currentLabel}
          </Button>
          <Menu
            anchorEl={passageMenuAnchor}
            open={Boolean(passageMenuAnchor)}
            onClose={() => setPassageMenuAnchor(null)}
          >
            {isStepProgression
              ? sectionPassages.map((p) => (
                  <MenuItem
                    key={p.id}
                    selected={p.id === passage?.id}
                    onClick={() => {
                      const remId = p.keys?.remoteId ?? p.id;
                      rememberCurrentPassage(memory, remId);
                      passageNavigate(`/detail/${prjId}/${remId}`);
                      setPassageMenuAnchor(null);
                    }}
                  >
                    {[p.attributes.book, p.attributes.reference]
                      .filter(Boolean)
                      .join(' ')}
                  </MenuItem>
                ))
              : workflow.map((step) => (
                  <MenuItem
                    key={step.id}
                    selected={step.id === currentstep}
                    onClick={() => {
                      handleSelect(step.id)();
                      setPassageMenuAnchor(null);
                    }}
                  >
                    {getWfLabel(step.label)}
                  </MenuItem>
                ))}
          </Menu>
        </Box>
        {/* Workflow step parallelograms */}
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
            {isStepProgression
              ? workflow.map((step) => {
                  const isCurrent = step.id === currentstep;
                  return (
                    <ButtonBase
                      key={step.id}
                      data-cy="workflow-step"
                      role="button"
                      onClick={handleSelect(step.id)}
                      tabIndex={0}
                      ref={(el) => {
                        if (el) stepRefs.current.set(step.id, el);
                        else stepRefs.current.delete(step.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                        }
                      }}
                      sx={{
                        flex: '0 0 80px',
                        height: 30,
                        mr: -0.25, // Overlap adjacent parallelograms so their edges meet cleanly
                        backgroundColor: isCurrent
                          ? theme.palette.grey[700]
                          : stepComplete(step.id)
                            ? theme.palette.grey[400]
                            : theme.palette.grey[200],
                        clipPath: 'polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)',
                        cursor:
                          recording || commentRecording
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                    />
                  );
                })
              : sectionPassages.map((p) => {
                  const isCurrent = p.id === passage?.id;
                  const isComplete =
                    (p.attributes.sequencenum ?? 0) <
                    (passage?.attributes?.sequencenum ?? 0);
                  return (
                    <ButtonBase
                      key={p.id}
                      data-cy="passage-step"
                      role="button"
                      onClick={() => {
                        if (recording || commentRecording) return;
                        if (getGlobal('remoteBusy')) {
                          showMessage(ts.wait);
                          return;
                        }
                        const remId = p.keys?.remoteId ?? p.id;
                        rememberCurrentPassage(memory, remId);
                        passageNavigate(`/detail/${prjId}/${remId}`);
                      }}
                      tabIndex={0}
                      ref={(el) => {
                        if (el) stepRefs.current.set(p.id, el);
                        else stepRefs.current.delete(p.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                        }
                      }}
                      sx={{
                        flex: '0 0 80px',
                        height: 30,
                        mr: -0.25, // Overlap adjacent parallelograms so their edges meet cleanly
                        backgroundColor: isCurrent
                          ? theme.palette.grey[700]
                          : isComplete
                            ? theme.palette.grey[400]
                            : theme.palette.grey[200],
                        clipPath: 'polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)',
                        cursor:
                          recording || commentRecording
                            ? 'not-allowed'
                            : 'pointer',
                      }}
                    />
                  );
                })}
            {/* Spacer to mirror the dropdown width so mx:auto centers the parallelograms */}
            <Box sx={{ flexShrink: 0, width: dropdownWidth }} />
          </Box>
        </Box>
      </Box>
      {(isStepProgression ? currentLabel : passage?.id) && (
        <Typography
          sx={{ mt: 1, textAlign: 'center' }}
          data-cy="workflow-step-label"
        >
          {isStepProgression ? (
            currentTip ? (
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
                <InfoIcon color="info" fontSize="small" />
              </ButtonBase>
            ) : (
              getWfLabel(currentLabel)
            )
          ) : (
            [passage?.attributes?.book, passage?.attributes?.reference]
              .filter(Boolean)
              .join(' ')
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
