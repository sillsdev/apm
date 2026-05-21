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
  align: 'left' | 'right';
}) {
  return (
    <Box
      component="span"
      title={title ?? text}
      sx={{
        display: 'block',
        minWidth: 0,
        maxWidth: '100%',
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
    promptPlaybackComplete,
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
  const passageNavigate = usePassageNavigate(() => {}, setCurrentStep);
  const { getOrgDefault } = useOrgDefaults();
  const { localizedWorkStepFromId } = useOrgWorkflowSteps();

  const isStepProgression =
    isBoldWorkflow || getOrgDefault(orgDefaultWorkflowProgression) === 'step';

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
    nextNavEnabled = nextNavEnabled && hasPrompt && promptPlaybackComplete;
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
  const nextButtonText =
    nextNavEnabled && nextLabelFull ? nextLabelFull : (t?.next ?? 'Next');

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

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: isBoldWorkflow
          ? 'minmax(0, 1fr) minmax(0, 1fr)'
          : 'minmax(0, 1fr) auto minmax(0, 1fr)',
        alignItems: 'center',
        gap: 0.5,
        width: '100%',
        minHeight: 0,
      }}
    >
      <Box sx={{ minWidth: 0, display: 'flex', justifyContent: 'flex-start' }}>
        <Button
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
          onClick={() => handleNavigate(false)}
          disabled={!prevNavEnabled}
          sx={{
            minWidth: 0,
            maxWidth: '100%',
            justifyContent: 'flex-start',
          }}
        >
          <NavButtonLabel
            text={prevButtonText}
            title={prevLabelFull}
            align="left"
          />
        </Button>
      </Box>
      {!isBoldWorkflow && (
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'center',
            minWidth: 'min-content',
          }}
        >
          <MobileStepComplete />
        </Box>
      )}
      <Box sx={{ minWidth: 0, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          size="small"
          endIcon={<ArrowForwardIcon fontSize="small" />}
          onClick={() => handleNavigate(true)}
          disabled={!nextNavEnabled}
          sx={{
            minWidth: 0,
            maxWidth: '100%',
            justifyContent: 'flex-end',
          }}
        >
          <NavButtonLabel
            text={nextButtonText}
            title={nextLabelFull}
            align="right"
          />
        </Button>
      </Box>
    </Box>
  );
}
