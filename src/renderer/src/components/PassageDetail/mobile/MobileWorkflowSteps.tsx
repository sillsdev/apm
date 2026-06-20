import {
  Box,
  Button,
  ButtonBase,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
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
import { useEffect, useMemo, useRef, useState } from 'react';
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
import { ToolSlug, useStepTool } from '../../../crud';
import { useRole } from '../../../crud/useRole';
import { useStepPermissions } from '../../../utils/useStepPermission';

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
  const [memory] = useGlobal('memory');
  const passageNavigate = usePassageNavigate(
    () => {},
    setCurrentStep,
    isNavigationBlocked
  );
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

  // Refs used to scroll the current step/passage into view
  const didMountRef = useRef(false);
  const stepRefs = useRef(new Map<string, HTMLElement>());

  // Ordered list of passages in the current section, excluding publishing-title rows, sorted by sequence number
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

  // The display label of the currently workflow step
  const currentLabel = useMemo(
    () => workflow.find((w) => w.id === currentstep)?.label ?? '',
    [currentstep, workflow]
  );

  // The tip text for the current workflow step
  const currentTip = useMemo(() => {
    if (!currentLabel) return '';
    if (tool === ToolSlug.Prompt && showPromptAdmin) {
      return t.promptAdminTip;
    }
    const tipKey = toCamel(currentLabel + 'Tip');
    return Object.prototype.hasOwnProperty.call(t, tipKey)
      ? t.getString(tipKey)
      : '';
  }, [currentLabel, t, tool, showPromptAdmin]);

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
        isCurrent: s.id === currentstep,
        isComplete: stepComplete(s.id),
        onClick: handleSelect(s.id),
      }))
    : sectionPassages.map((p) => ({
        id: p.id,
        dataCy: 'passage-step',
        isCurrent: p.id === passage?.id,
        isComplete:
          (p.attributes.sequencenum ?? 0) <
          (passage?.attributes?.sequencenum ?? 0),
        onClick: () => {
          if (isInteractionBlocked()) return;
          navigateToPassage(p);
        },
      }));

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
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 1,
        px: 1.5,
      }}
      data-cy="workflow-steps"
    >
      {/* Top row with the passage dropdown and parallelograms */}
      <Box
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
        }}
      >
        {/* Passage dropdown */}
        <Box
          sx={{
            flexShrink: 0,
            position: 'relative',
            zIndex: 1,
            mr: 1,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {!isStepProgression && currentTip && (
            <IconButton
              size="small"
              onClick={() => setTipOpen(true)}
              data-cy="workflow-step-tip"
              aria-label={currentTip}
              color="info"
            >
              <InfoIcon fontSize="small" />
            </IconButton>
          )}
          <Button
            size="small"
            endIcon={hasMultipleOptions ? <ArrowDropDownIcon /> : undefined}
            sx={{
              minWidth: 'auto',
              textTransform: 'none',
              // These per-breakpoint widths are fine-tuned to constrain the dropdown so
              // its label truncates before it can overlap the parallelograms
              maxWidth: { xs: '45vw', md: '20vw', lg: '25vw' },
            }}
            onClick={(e) => {
              if (!hasMultipleOptions) return;
              if (recording || commentRecording) return;
              if (getGlobal('remoteBusy')) {
                showMessage(ts.wait);
                return;
              }
              setPassageMenuAnchor(e.currentTarget);
            }}
            data-cy="passage-dropdown"
          >
            <Box
              component="span"
              sx={{
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {isStepProgression
                ? passageRef(passage)
                : getWfLabel(currentLabel)}
            </Box>
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
                      navigateToPassage(p);
                      setPassageMenuAnchor(null);
                    }}
                    sx={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {passageRef(p)}
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
                    sx={{
                      display: 'block',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getWfLabel(step.label)}
                  </MenuItem>
                ))}
          </Menu>
        </Box>

        {/* Step/passage parallelograms */}
        <Box
          sx={{
            overflowX: 'auto',
            display: 'flex',
            flex: { xs: 1, md: 'none' },
            position: { md: 'absolute' },
            left: { md: 0 },
            right: { md: 0 },
            '&::before, &::after': {
              content: '""',
              margin: 'auto',
            },
          }}
        >
          {steps.map((step) => {
            const color = step.isCurrent
              ? theme.palette.grey[700]
              : step.isComplete
                ? theme.palette.grey[400]
                : theme.palette.grey[200];
            return (
              <Box
                key={step.id}
                data-cy={step.dataCy}
                ref={(el: HTMLElement | null) => {
                  if (el) stepRefs.current.set(step.id, el);
                  else stepRefs.current.delete(step.id);
                }}
                onClick={step.onClick}
                sx={{
                  flex: '0 0 80px',
                  height: 30,
                  bgcolor: color,
                  mr: -0.25,
                  clipPath: 'polygon(10% 0%, 100% 0%, 90% 100%, 0% 100%)',
                  cursor:
                    recording || commentRecording ? 'not-allowed' : 'pointer',
                }}
              />
            );
          })}
        </Box>

        {/* Spacer to center the parallelograms in the top row on desktop screens */}
        <Box
          sx={{ height: 30, flex: 1, display: { xs: 'none', md: 'block' } }}
        />
      </Box>

      {/* Bottom row with the labels */}
      <Typography sx={{ mt: 1 }} data-cy="workflow-step-label">
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
          passageRef(passage)
        )}
      </Typography>

      {/* Tip dialog */}
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
