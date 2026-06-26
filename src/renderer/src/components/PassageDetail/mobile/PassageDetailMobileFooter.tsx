import { Box, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useMemo } from 'react';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import MobileStepComplete from './MobileStepComplete';
import { usePassageNavigate } from '../usePassageNavigate';
import { useGlobal } from '../../../context/useGlobal';
import { rememberCurrentPassage } from '../../../utils';
import { nextPassageRecord } from '../../../crud/nextPasId';
import { prevPassageRecord } from '../../../crud/prevPasId';
import { useParams } from 'react-router-dom';
import { shallowEqual, useSelector } from 'react-redux';
import { mobileSelector } from '../../../selector';
import { IMobileStrings, OrgWorkflowStepD } from '../../../model';
import {
  orgDefaultWorkflowProgression,
  useOrgDefaults,
  WorkflowProgression,
} from '../../../crud/useOrgDefaults';
import { useOrgWorkflowSteps } from '../../../crud/useOrgWorkflowSteps';
import { ToolSlug, useStepTool } from '../../../crud';
import { usePromptSectionResource } from '../Prompt/usePromptSectionResource';
import { useRole } from '../../../crud/useRole';
import { useStepPermissions } from '../../../utils/useStepPermission';

function NavButtonLabel({
  text,
  title,
  align,
}: {
  text: string;
  title?: string;
  align: 'left' | 'center' | 'right';
}) {
  return (
    <Box
      component="span"
      title={title ?? text}
      sx={{
        flexGrow: 1,
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        textAlign: align,
      }}
    >
      {text}
    </Box>
  );
}

export default function PassageDetailMobileFooter() {
  const {
    section,
    passage,
    setCurrentStep,
    currentstep,
    orgWorkflowSteps = [],
    isBoldWorkflow,
    rowData,
    isNavigationBlocked,
  } = usePassageDetailContext();
  const { tool } = useStepTool(currentstep);
  const { hasPrompt } = usePromptSectionResource(rowData, section, currentstep);
  const { userIsAdmin } = useRole();
  const { canDoSectionStep, permissionsOn } = useStepPermissions();
  const showPromptAdmin =
    userIsAdmin || (permissionsOn && canDoSectionStep(currentstep, section));
  const t: IMobileStrings = useSelector(mobileSelector, shallowEqual);
  const [memory] = useGlobal('memory');
  const { prjId } = useParams();
  const passageNavigate = usePassageNavigate(
    () => {},
    setCurrentStep,
    isNavigationBlocked
  );
  const { getOrgDefault } = useOrgDefaults();
  const { localizedWorkStepFromId } = useOrgWorkflowSteps();

  const isStepProgression =
    isBoldWorkflow ||
    getOrgDefault(orgDefaultWorkflowProgression) === WorkflowProgression.Step;

  const sortedSteps = useMemo(
    () =>
      [...orgWorkflowSteps].sort(
        (a, b) => a.attributes.sequencenum - b.attributes.sequencenum
      ),
    [orgWorkflowSteps]
  );

  const stepIndex = sortedSteps.findIndex((s) => s.id === currentstep);
  const nextStepRec: OrgWorkflowStepD | undefined =
    stepIndex >= 0 && stepIndex < sortedSteps.length - 1
      ? sortedSteps[stepIndex + 1]
      : undefined;
  const prevStepRec: OrgWorkflowStepD | undefined =
    stepIndex > 0 ? sortedSteps[stepIndex - 1] : undefined;

  const nextPassRec = isStepProgression
    ? undefined
    : nextPassageRecord(section, passage.id, memory);
  const prevPassRec = isStepProgression
    ? undefined
    : prevPassageRecord(section, passage.id, memory);

  const prevNavEnabled = isStepProgression
    ? Boolean(prevStepRec)
    : Boolean(prevPassRec);
  let nextNavEnabled = isStepProgression
    ? Boolean(nextStepRec)
    : Boolean(nextPassRec);
  if (tool === ToolSlug.Prompt && isStepProgression && !showPromptAdmin) {
    nextNavEnabled = nextNavEnabled && hasPrompt;
  }

  const prevLabelFull = isStepProgression
    ? prevStepRec
      ? localizedWorkStepFromId(prevStepRec.id)
      : ''
    : (prevPassRec?.attributes?.reference ?? '');

  const nextLabelFull = isStepProgression
    ? nextStepRec
      ? localizedWorkStepFromId(nextStepRec.id)
      : ''
    : (nextPassRec?.attributes?.reference ?? '');

  const prevButtonText =
    prevNavEnabled && prevLabelFull
      ? prevLabelFull
      : (t?.previous ?? 'Previous');
  const nextButtonText = nextLabelFull || (t?.next ?? 'Next');

  const handleNavigate = (forward: boolean) => {
    if (isStepProgression) {
      const stepRec = forward ? nextStepRec : prevStepRec;
      if (stepRec) setCurrentStep(stepRec.id);
      return;
    }
    const targetId = forward
      ? nextPassRec?.keys?.remoteId
      : prevPassRec?.keys?.remoteId;
    if (targetId && targetId !== passage?.keys?.remoteId) {
      rememberCurrentPassage(memory, targetId);
      passageNavigate(`/detail/${prjId}/${targetId}`);
    }
  };

  const navButtonSx = {
    flex: 1,
    minWidth: 'clamp(60px, 16vw, 100px)',
    maxWidth: 'clamp(110px, 30vw, 190px)',
  } as const;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1,
        width: '100%',
      }}
    >
      <Button
        size="small"
        startIcon={<ArrowBackIcon fontSize="small" />}
        onClick={() => handleNavigate(false)}
        disabled={!prevNavEnabled}
        sx={{ ...navButtonSx, justifyContent: 'center' }}
      >
        <NavButtonLabel
          text={prevButtonText}
          title={prevLabelFull}
          align="center"
        />
      </Button>
      {!isBoldWorkflow && <MobileStepComplete />}
      <Button
        size="small"
        endIcon={<ArrowForwardIcon fontSize="small" />}
        onClick={() => handleNavigate(true)}
        disabled={!nextNavEnabled}
        sx={{ ...navButtonSx, justifyContent: 'center' }}
      >
        <NavButtonLabel
          text={nextButtonText}
          title={nextLabelFull}
          align="center"
        />
      </Button>
    </Box>
  );
}
