import { useCallback, useContext, useMemo, useState } from 'react';
import { useGlobal } from '../../../context/useGlobal';
import { Box, IconButton, Typography } from '@mui/material';
import CompleteIcon from '@mui/icons-material/CheckBoxOutlined';
import NotCompleteIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { IPassageDetailStepCompleteStrings } from '../../../model';
import { passageDetailStepCompleteSelector } from '../../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { useStepPermissions } from '../../../utils/useStepPermission';
import { ToolSlug, useStepTool } from '../../../crud';
import { UnsavedContext } from '../../../context/UnsavedContext';
import { verseToolId } from '../markVersesTool';
import { useSnackBar } from '../../../hoc/SnackBar';

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
    isBoldWorkflow,
  } = usePassageDetailContext();
  const { tool } = useStepTool(currentstep);
  const { canDoSectionStep } = useStepPermissions();
  const { isChanged, startSave, waitForSave } = useContext(UnsavedContext).state;
  const { showMessage } = useSnackBar();
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
    const finish = async () => {
      await setStepComplete(currentstep, !complete);
      if (!curStatus) gotoNextStep();
    };

    if (!curStatus && tool === ToolSlug.Verses && isChanged(verseToolId)) {
      startSave(verseToolId);
      try {
        await waitForSave(undefined, 400);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message) showMessage(message);
        return;
      }
    }

    await finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complete, currentstep, tool, isChanged, startSave, waitForSave]);

  if (isBoldWorkflow) return null;

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        minHeight: 0,
        flexShrink: 0,
        maxWidth: '100%',
      }}
    >
      <IconButton
        id="mobile-complete"
        size="small"
        title={t.title}
        onClick={handleToggleComplete}
        disabled={
          !hasPermission || view !== '' || recording || busy || importexportBusy
        }
      >
        {complete ? (
          <CompleteIcon id="step-yes" fontSize="small" />
        ) : (
          <NotCompleteIcon id="step-no" fontSize="small" />
        )}
      </IconButton>
      <Typography
        variant="body2"
        sx={{ lineHeight: 1.2, whiteSpace: 'nowrap' }}
      >
        {t.title}
      </Typography>
    </Box>
  );
}
