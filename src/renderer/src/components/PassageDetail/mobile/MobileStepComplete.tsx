import { useCallback, useMemo, useState } from 'react';
import { useGlobal } from '../../../context/useGlobal';
import { Box, IconButton, Typography } from '@mui/material';
import CompleteIcon from '@mui/icons-material/CheckBoxOutlined';
import NotCompleteIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { IPassageDetailStepCompleteStrings } from '../../../model';
import { passageDetailStepCompleteSelector } from '../../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { useStepPermissions } from '../../../utils/useStepPermission';

export default function MobileStepComplete() {
  const {
    currentstep,
    stepComplete,
    setStepComplete,
    gotoNextStep,
    psgCompleted,
    section,
    passage,
    recording,
  } = usePassageDetailContext();
  const { canDoSectionStep } = useStepPermissions();
  const [busy] = useGlobal('remoteBusy');
  const [importexportBusy] = useGlobal('importexportBusy');
  const [view] = useState('');
  const t: IPassageDetailStepCompleteStrings = useSelector(
    passageDetailStepCompleteSelector,
    shallowEqual
  );

  const hasPermission = canDoSectionStep(currentstep, section);
  const complete = useMemo(
    () => stepComplete(currentstep),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentstep, psgCompleted]
  );

  const handleToggleComplete = useCallback(async () => {
    const curStatus = complete;
    await setStepComplete(currentstep, !complete);
    if (!curStatus) gotoNextStep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, currentstep, passage, section]);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <IconButton
        id="mobile-complete"
        title={t.title}
        onClick={handleToggleComplete}
        disabled={
          !hasPermission || view !== '' || recording || busy || importexportBusy
        }
      >
        {complete ? (
          <CompleteIcon id="step-yes" />
        ) : (
          <NotCompleteIcon id="step-no" />
        )}
      </IconButton>
      <Typography variant="body2">{t.title}</Typography>
    </Box>
  );
}
