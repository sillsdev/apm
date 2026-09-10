import { useEffect, useMemo, useRef, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
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
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import InfoIcon from '@mui/icons-material/Info';
import { IWorkflowStepsStrings, PassageD } from '../../../model';
import { sharedSelector, workflowStepsSelector } from '../../../selector';
import { useGetGlobal, useGlobal } from '../../../context/useGlobal';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { useSnackBar } from '../../../hoc/SnackBar';
import { ToolSlug, useOrganizedBy, useStepTool } from '../../../crud';
import { passagesForSection } from '../../../crud/passagesForSection';
import {
  orgDefaultWorkflowProgression,
  useOrgDefaults,
  WorkflowProgression,
} from '../../../crud/useOrgDefaults';
import { useRole } from '../../../crud/useRole';
import { Button, columnSx, spreadSx } from '../../../control';
import { isPublishingTitle } from '../../../control/passageTypeFromRef';
import { rememberCurrentPassage } from '../../../utils';
import { toCamel } from '../../../utils/toCamel';
import { useStepPermissions } from '../../../utils/useStepPermission';
import { useWfLabel } from '../../../utils/useWfLabel';
import { usePassageNavigate } from '../usePassageNavigate';

const MobileWorkflowSteps = () => {
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
  const [memory] = useGlobal('memory');
  const getGlobal = useGetGlobal();
  const t: IWorkflowStepsStrings = useSelector(
    workflowStepsSelector,
    shallowEqual
  );
  const ts = useSelector(sharedSelector, shallowEqual);
  const { showMessage } = useSnackBar();
  const getWfLabel = useWfLabel();
  const passageNavigate = usePassageNavigate(
    () => {},
    setCurrentStep,
    isNavigationBlocked
  );
  const { getOrgDefault } = useOrgDefaults();
  const isStepProgression =
    getOrgDefault(orgDefaultWorkflowProgression) === WorkflowProgression.Step;
  const { getOrganizedBy } = useOrganizedBy();
  const [organizedBy] = useState(getOrganizedBy(true));
  const { tool } = useStepTool(currentstep);
  const { userIsAdmin } = useRole();
  const { canDoSectionStep, permissionsOn } = useStepPermissions();
  const showPromptAdmin =
    userIsAdmin || (permissionsOn && canDoSectionStep(currentstep, section));

  const [tipOpen, setTipOpen] = useState(false);
  const [passageMenuAnchor, setPassageMenuAnchor] =
    useState<HTMLElement | null>(null);

  // Refs used to scroll the current step/passage into view
  const didMountRef = useRef(false);
  const stepRefs = useRef(new Map<string, HTMLElement>());

  // Ordered list of passages in the current section, excluding publishing-title rows, sorted by sequence number
  const sectionPassages = useMemo<PassageD[]>(() => {
    return passagesForSection(memory, section?.id)
      .filter(
        (p) => Boolean(p) && !isPublishingTitle(p?.attributes?.reference, false)
      )
      .sort((a, b) => a.attributes.sequencenum - b.attributes.sequencenum);
  }, [section?.id, memory]);

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

  // The step/passage data model for the dropdown menu
  const menuOptions = isStepProgression
    ? sectionPassages.map((p) => ({
        id: p.id,
        label: passageRef(p),
        selected: p.id === passage?.id,
        onSelect: () => navigateToPassage(p),
      }))
    : workflow.map((s) => ({
        id: s.id,
        label: getWfLabel(s.label),
        selected: s.id === currentstep,
        onSelect: handleSelect(s.id),
      }));

  // Check if the dropdown has more than one option to pick from
  const hasMultipleOptions = menuOptions.length > 1;

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
  ]);

  return (
    <>
      <Box sx={[columnSx, { alignItems: 'center' }]}>
        {/* Dropdown button and racetrack */}
        <Box sx={[spreadSx, { alignItems: 'center' }]}>
          {/* Dropdown button */}
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
          </Box>
          {/* Racetrack parallelograms */}
          <Box sx={{ display: 'flex', overflowX: 'auto' }}>
            {steps.map((step) => {
              const color = step.isCurrent
                ? 'custom.racetrackCurrent'
                : step.isComplete
                  ? 'custom.racetrackComplete'
                  : 'custom.racetrackIncomplete';
              const textColor = step.isCurrent
                ? 'common.white'
                : 'common.black';
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
                  <Typography variant="body2" noWrap>
                    {step.label}
                  </Typography>
                </CardActionArea>
              );
            })}
          </Box>
          {/* Spacer to push the racetrack to the center */}
          <Box sx={{ flex: 1 }} />
        </Box>
        {/* Label */}
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
      </Box>
      <Menu
        anchorEl={passageMenuAnchor}
        open={Boolean(passageMenuAnchor)}
        onClose={() => setPassageMenuAnchor(null)}
      >
        {menuOptions.map((option) => (
          <MenuItem
            key={option.id}
            sx={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            selected={option.selected}
            onClick={() => {
              option.onSelect();
              setPassageMenuAnchor(null);
            }}
          >
            {option.label}
          </MenuItem>
        ))}
      </Menu>
      <Dialog open={tipOpen} onClose={() => setTipOpen(false)}>
        <DialogTitle>{getWfLabel(currentLabel)}</DialogTitle>
        <DialogContent>{currentTip}</DialogContent>
        <DialogActions>
          <Button onClick={() => setTipOpen(false)}>{ts.close}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default MobileWorkflowSteps;
