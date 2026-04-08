import { Box, Button } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useMemo } from 'react';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import MobileStepComplete from './MobileStepComplete';
import { usePassageNavigate } from '../usePassageNavigate';
import { useGlobal } from '../../../context/useGlobal';
import { rememberCurrentPassage } from '../../../utils';
import { nextPasId, nextPassageRecord } from '../../../crud/nextPasId';
import { prevPasId, prevPassageRecord } from '../../../crud/prevPasId';
import { useParams } from 'react-router-dom';
import { shallowEqual, useSelector } from 'react-redux';
import { mobileSelector } from '../../../selector';
import { IMobileStrings, OrgWorkflowStepD } from '../../../model';
import {
  orgDefaultWorkflowProgression,
  useOrgDefaults,
} from '../../../crud/useOrgDefaults';
import { useOrgWorkflowSteps } from '../../../crud/useOrgWorkflowSteps';

const NAV_LABEL_MAX_PX = 120;

function NavButtonLabel({ text, title }: { text: string; title?: string }) {
  return (
    <Box
      component="span"
      title={title ?? text}
      sx={{
        display: 'block',
        maxWidth: NAV_LABEL_MAX_PX,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
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
  } = usePassageDetailContext();
  const t: IMobileStrings = useSelector(mobileSelector, shallowEqual);
  const [memory] = useGlobal('memory');
  const { prjId } = useParams();
  const passageNavigate = usePassageNavigate(() => {}, setCurrentStep);
  const { getOrgDefault } = useOrgDefaults();
  const { localizedWorkStepFromId } = useOrgWorkflowSteps();

  const isStepProgression =
    getOrgDefault(orgDefaultWorkflowProgression) === 'step';

  const nextId = nextPasId(section, passage.id, memory);
  const prevId = prevPasId(section, passage.id, memory);

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

  const nextPassRec = nextPassageRecord(section, passage.id, memory);
  const prevPassRec = prevPassageRecord(section, passage.id, memory);

  const prevNavEnabled = isStepProgression
    ? Boolean(prevStepRec)
    : Boolean(prevId);
  const nextNavEnabled = isStepProgression
    ? Boolean(nextStepRec)
    : Boolean(nextId);

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
    const targetId = forward ? nextId : prevId;
    if (targetId && targetId !== passage?.keys?.remoteId) {
      rememberCurrentPassage(memory, targetId);
      passageNavigate(`/detail/${prjId}/${targetId}`);
    }
  };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        width: '100%',
        minHeight: 0,
      }}
    >
      <Button
        size="small"
        startIcon={<ArrowBackIcon fontSize="small" />}
        onClick={() => handleNavigate(false)}
        disabled={!prevNavEnabled}
        sx={{ minWidth: 0, flexShrink: 1 }}
      >
        <NavButtonLabel text={prevButtonText} title={prevLabelFull} />
      </Button>
      <Box
        sx={{ flex: 1, display: 'flex', justifyContent: 'center', minWidth: 0 }}
      >
        <MobileStepComplete />
      </Box>
      <Button
        size="small"
        endIcon={<ArrowForwardIcon fontSize="small" />}
        onClick={() => handleNavigate(true)}
        disabled={!nextNavEnabled}
        sx={{ minWidth: 0, flexShrink: 1 }}
      >
        <NavButtonLabel text={nextButtonText} title={nextLabelFull} />
      </Button>
    </Box>
  );
}
