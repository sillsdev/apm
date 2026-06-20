import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useGlobal } from '../../context/useGlobal';
import { IconButton, Box, Typography } from '@mui/material';
import CompleteIcon from '@mui/icons-material/CheckBoxOutlined';
import NotCompleteIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import ChecklistIcon from '@mui/icons-material/Checklist';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import { IPassageDetailStepCompleteStrings } from '../../model';
import { usePassageNavigate } from './usePassageNavigate';
import { passageDetailStepCompleteSelector } from '../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { useStepPermissions } from '../../utils/useStepPermission';
import { ToolSlug, useStepTool } from '../../crud';
import { useMobile } from '../../utils';
import { UnsavedContext } from '../../context/UnsavedContext';
import { verseToolId } from './markVersesTool';
import { useSnackBar } from '../../hoc/SnackBar';
import { showsBoldDesktopStepComplete } from './boldDesktopStepComplete';

export const PassageDetailStepComplete = () => {
  const {
    currentstep,
    setCurrentStep,
    stepComplete,
    setStepComplete,
    setStepCompleteTo,
    gotoNextStep,
    psgCompleted,
    section,
    recording,
    isBoldWorkflow,
    mediafileId,
    isNavigationBlocked,
  } = usePassageDetailContext();
  const { tool } = useStepTool(currentstep);
  const { isMobile } = useMobile();
  const { canDoSectionStep, canAlwaysDoStep } = useStepPermissions();
  const { pathname } = useLocation();
  const [busy] = useGlobal('remoteBusy'); //verified this is not used in a function 2/18/25
  const [importexportBusy] = useGlobal('importexportBusy'); //verified this is not used in a function 2/18/25
  const [view, setView] = useState('');
  const t: IPassageDetailStepCompleteStrings = useSelector(
    passageDetailStepCompleteSelector,
    shallowEqual
  );
  const passageNavigate = usePassageNavigate(
    () => {
      setView('');
    },
    setCurrentStep,
    isNavigationBlocked
  );
  const { isChanged, startSave, waitForSave } =
    useContext(UnsavedContext).state;
  const { showMessage } = useSnackBar();

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
        await waitForSave(undefined, 25);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        if (message) showMessage(message);
        return;
      }
    }

    await finish();
  }, [
    complete,
    currentstep,
    tool,
    isChanged,
    startSave,
    waitForSave,
    setStepComplete,
    gotoNextStep,
    showMessage,
  ]);

  const handleSetCompleteTo = async () => {
    setStepCompleteTo(currentstep);
  };
  useEffect(() => {
    if (!busy && !importexportBusy && view) {
      if (pathname !== view) {
        passageNavigate(view);
      } else setView('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, busy, importexportBusy]);

  useEffect(() => {
    if (view) setView('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const boldRecordCheckboxDisabled =
    isBoldWorkflow &&
    tool === ToolSlug.Record &&
    (!mediafileId || isChanged('RecordTool'));

  if (isBoldWorkflow && (!showsBoldDesktopStepComplete(tool) || isMobile)) {
    return null;
  }

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', minWidth: 0, flexShrink: 1 }}
    >
      <Typography
        sx={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          flexShrink: 1,
          minWidth: 0,
        }}
      >
        {t.title}
      </Typography>
      <IconButton
        id="complete"
        sx={{ color: 'primary.light' }}
        title={t.title}
        onClick={handleToggleComplete}
        disabled={
          !hasPermission ||
          view !== '' ||
          recording ||
          boldRecordCheckboxDisabled
        }
      >
        {complete ? (
          <CompleteIcon id="step-yes" />
        ) : (
          <NotCompleteIcon id="step-no" />
        )}
      </IconButton>
      <IconButton
        id="setnetxt"
        sx={{ color: 'primary.light' }}
        title={t.setNext}
        onClick={handleSetCompleteTo}
        disabled={!canAlwaysDoStep() || view !== ''}
      >
        <ChecklistIcon id="step-next" />
      </IconButton>
    </Box>
  );
};
export default PassageDetailStepComplete;
