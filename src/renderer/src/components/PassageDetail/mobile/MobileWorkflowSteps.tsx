import {
  Box,
  CardActionArea,
  cardActionAreaClasses,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Typography,
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
import { passagesForSection } from '../../../crud/passagesForSection';
import { rememberCurrentPassage } from '../../../utils';
import { usePassageNavigate } from '../usePassageNavigate';
import { isPublishingTitle } from '../../../control/passageTypeFromRef';
import {
  orgDefaultWorkflowProgression,
  useOrgDefaults,
  WorkflowProgression,
} from '../../../crud/useOrgDefaults';
import { ToolSlug, useOrganizedBy, useStepTool } from '../../../crud';
import { useRole } from '../../../crud/useRole';
import { useStepPermissions } from '../../../utils/useStepPermission';
import { Button, columnSx, spreadSx } from '../../../control';

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
    isNavigationBlocked,
  } = usePassageDetailContext();
  const { tool } = useStepTool(currentstep);
  const { userIsAdmin } = useRole();
  const { canDoSectionStep, permissionsOn } = useStepPermissions();
  const showPromptAdmin =
    userIsAdmin || (permissionsOn && canDoSectionStep(currentstep, section));
  const { getOrganizedBy } = useOrganizedBy();
  const [organizedBy] = useState(getOrganizedBy(true));
  const [memory] = useGlobal('memory');
  const passageNavigate = usePassageNavigate(
    () => {},
    setCurrentStep,
    isNavigationBlocked
  );
  const getGlobal = useGetGlobal();
  const { showMessage } = useSnackBar();
  const ts = useSelector(sharedSelector, shallowEqual);
  const getWfLabel = useWfLabel();
  const { getOrgDefault } = useOrgDefaults();
  const isStepProgression =
    getOrgDefault(orgDefaultWorkflowProgression) === WorkflowProgression.Step;
  const t: IWorkflowStepsStrings = useSelector(
    workflowStepsSelector,
    shallowEqual
  );

  // Refs used to scroll the current step/passage into view
  const didMountRef = useRef(false);
  const stepRefs = useRef(new Map<string, HTMLElement>());

  // Refs to each parallelogram's label, used to size every parallelogram to the width of the longest one
  const labelRefs = useRef(new Map<string, HTMLElement>());
  const [stepWidth, setStepWidth] = useState<number | undefined>(undefined);

  // Ordered list of passages in the current section, excluding publishing-title rows, sorted by sequence number
  const sectionPassages = useMemo<PassageD[]>(() => {
    return passagesForSection(memory, section?.id)
      .filter(
        (p) => Boolean(p) && !isPublishingTitle(p?.attributes?.reference, false)
      )
      .sort((a, b) => a.attributes.sequencenum - b.attributes.sequencenum);
  }, [section?.id, memory]);

  const [tipOpen, setTipOpen] = useState(false);
  const [passageMenuAnchor, setPassageMenuAnchor] =
    useState<HTMLElement | null>(null);

  // The display label of the currently workflow step
  const currentLabel = useMemo(
    () => workflow.find((w) => w.id === currentstep)?.label ?? '',
    [currentstep, workflow]
  );

  // The tip text for the current workflow step
  const currentTip = useMemo(() => {
    if (!currentLabel) return '';
    if (tool === ToolSlug.Prompt && showPromptAdmin) {
      return t.promptAdminTip.replace('{0}', organizedBy);
    }
    const tipKey = toCamel(currentLabel + 'Tip');
    return Object.prototype.hasOwnProperty.call(t, tipKey)
      ? t.getString(tipKey)
      : '';
  }, [currentLabel, t, tool, showPromptAdmin, organizedBy]);

  const passageRef = (p?: PassageD) =>
    [p?.attributes?.book, p?.attributes?.reference].filter(Boolean).join(' ');

  const navigateToPassage = (p: PassageD) => {
    const remId = p.keys?.remoteId ?? p.id;
    rememberCurrentPassage(memory, remId);
    passageNavigate(`/detail/${prjId}/${remId}`);
  };

  // Check if the dropdown has more than one option to pick from
  const dropdownOptions = isStepProgression ? sectionPassages : workflow;
  const hasMultipleOptions = dropdownOptions.length > 1;

  const handleSelect = (id: string) => () => {
    if (getGlobal('remoteBusy')) {
      showMessage(ts.wait);
      return;
    }
    if (!recording && !commentRecording && id !== currentstep) {
      setCurrentStep(id);
    }
  };

  const isInteractionBlocked = () => {
    if (recording || commentRecording) return true;
    if (getGlobal('remoteBusy')) {
      showMessage(ts.wait);
      return true;
    }
    return false;
  };

  // The step/passage data model for the parallelograms
  const steps = isStepProgression
    ? workflow.map((s) => ({
        id: s.id,
        dataCy: 'workflow-step',
        label: getWfLabel(s.label),
        isCurrent: s.id === currentstep,
        isComplete: stepComplete(s.id),
        onClick: handleSelect(s.id),
      }))
    : sectionPassages.map((p) => ({
        id: p.id,
        dataCy: 'passage-step',
        label: passageRef(p),
        isCurrent: p.id === passage?.id,
        isComplete:
          (p.attributes.sequencenum ?? 0) <
          (passage?.attributes?.sequencenum ?? 0),
        onClick: () => {
          if (isInteractionBlocked()) return;
          navigateToPassage(p);
        },
      }));

  // The labels joined together, used to re-measure when any label changes (e.g. localization)
  const labelKey = steps.map((s) => s.label).join(' ');

  // Measure every label and size all parallelograms to the widest one so they are all of equal length
  useLayoutEffect(() => {
    let max = 0;
    labelRefs.current.forEach((el) => {
      max = Math.max(max, el.scrollWidth);
    });
    if (max > 0) {
      // Add 12 px horizontal padding to each side of the label
      // Cap the maximum width of the parallelograms at 120 px
      setStepWidth(Math.min(Math.ceil(max) + 12, 120));
    }
  }, [labelKey]);

  // Keep the current step/passage scrolled into view
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
    stepWidth,
  ]);

  return (
    <Box sx={[columnSx, { alignItems: 'center' }]}>
      <Box sx={[spreadSx, { alignItems: 'center' }]}>
        <Box sx={{ flex: 1, minWidth: 'max-content' }}>
          {hasMultipleOptions && (
            <Button
              data-cy="passage-dropdown"
              startIcon={
                !isStepProgression && currentTip ? (
                  <InfoIcon
                    data-cy="workflow-step-tip"
                    aria-label={currentTip}
                    sx={{ color: 'primary.light' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setTipOpen(true);
                    }}
                  />
                ) : undefined
              }
              endIcon={<ArrowDropDownIcon />}
              onClick={(e) => {
                if (!hasMultipleOptions) return;
                if (recording || commentRecording) return;
                if (getGlobal('remoteBusy')) {
                  showMessage(ts.wait);
                  return;
                }
                setPassageMenuAnchor(e.currentTarget);
              }}
            >
              {isStepProgression
                ? passageRef(passage)
                : getWfLabel(currentLabel)}
            </Button>
          )}
          <Menu
            anchorEl={passageMenuAnchor}
            open={Boolean(passageMenuAnchor)}
            onClose={() => setPassageMenuAnchor(null)}
          >
            {isStepProgression
              ? sectionPassages.map((p) => (
                  <MenuItem
                    key={p.id}
                    sx={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                    selected={p.id === passage?.id}
                    onClick={() => {
                      navigateToPassage(p);
                      setPassageMenuAnchor(null);
                    }}
                  >
                    {passageRef(p)}
                  </MenuItem>
                ))
              : workflow.map((step) => (
                  <MenuItem
                    key={step.id}
                    sx={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
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
        <Box sx={{ display: 'flex', overflowX: 'auto' }}>
          {steps.map((step) => {
            const color = step.isCurrent
              ? 'custom.racetrackCurrent'
              : step.isComplete
                ? 'custom.racetrackComplete'
                : 'custom.racetrackIncomplete';
            const textColor = step.isCurrent ? 'common.white' : 'common.black';
            const blocked = recording || commentRecording;
            return (
              <CardActionArea
                key={step.id}
                data-cy={step.dataCy}
                ref={(el: HTMLElement | null) => {
                  if (el) stepRefs.current.set(step.id, el);
                  else stepRefs.current.delete(step.id);
                }}
                disableRipple={blocked}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: `0 0 ${stepWidth ?? 80}px`,
                  minWidth: 150,
                  height: 30,
                  // Horizontal padding clears the slanted edges so the label
                  // isn't clipped by the parallelogram's angled corners
                  px: 2.5,
                  bgcolor: color,
                  color: textColor,
                  clipPath:
                    'polygon(8px 0%, 100% 0%, calc(100% - 8px) 100%, 0% 100%)',
                  cursor: blocked ? 'not-allowed' : 'pointer',
                  // Suppress the hover highlight while steps can't be selected
                  ...(blocked && {
                    [`& .${cardActionAreaClasses.focusHighlight}`]: {
                      display: 'none',
                    },
                  }),
                }}
                onClick={step.onClick}
              >
                <Typography
                  variant="body2"
                  noWrap
                  ref={(el: HTMLElement | null) => {
                    if (el) labelRefs.current.set(step.id, el);
                    else labelRefs.current.delete(step.id);
                  }}
                >
                  {step.label}
                </Typography>
              </CardActionArea>
            );
          })}
        </Box>
        <Box sx={{ flex: 1 }} />
      </Box>
      <Box
        data-cy="workflow-step-label"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          maxWidth: '70%',
        }}
      >
        <Typography noWrap>
          {isStepProgression ? getWfLabel(currentLabel) : passageRef(passage)}
        </Typography>
        {isStepProgression && currentTip && (
          <IconButton
            data-cy="workflow-step-tip"
            aria-label={currentTip}
            sx={{ p: 0.5 }}
            onClick={() => setTipOpen(true)}
          >
            <InfoIcon sx={{ color: 'primary.light' }} fontSize="small" />
          </IconButton>
        )}
      </Box>
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
