import { useCallback, useContext, useMemo } from 'react';
import { useGlobal } from '../../../context/useGlobal';
import { Box } from '@mui/material';
import CompleteIcon from '@mui/icons-material/CheckBox';
import NotCompleteIcon from '@mui/icons-material/CheckBoxOutlineBlank';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { IPassageDetailStepCompleteStrings } from '../../../model';
import { passageDetailStepCompleteSelector } from '../../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { useStepPermissions } from '../../../utils/useStepPermission';
import { isLinkedNote } from '../../../crud/isLinkedNote';
import { ToolSlug, useStepTool } from '../../../crud';
import { UnsavedContext } from '../../../context/UnsavedContext';
import { verseToolId } from '../markVersesTool';
import { useSnackBar } from '../../../hoc/SnackBar';
import { Button } from '../../../control';

export default function MobileStepComplete() {
  const {
    currentstep,
    stepComplete,
    setStepComplete,
    gotoNextStep,
    psgCompleted,
    section,
    recording,
    isBoldWorkflow,
    passage,
    sharedResource,
  } = usePassageDetailContext();
  const { tool } = useStepTool(currentstep);
  const { canDoSectionStep } = useStepPermissions();
  const { isChanged, startSave, waitForSave } =
    useContext(UnsavedContext).state;
  const { showMessage } = useSnackBar();
  const [busy] = useGlobal('remoteBusy');
  const [importexportBusy] = useGlobal('importexportBusy');
  const t: IPassageDetailStepCompleteStrings = useSelector(
    passageDetailStepCompleteSelector,
    shallowEqual
  );

  const hasPermission =
    canDoSectionStep(currentstep, section) &&
    !isLinkedNote(passage, sharedResource);
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

  if (isBoldWorkflow) return null;

  return (
    <Button
      disableTypography
      id="mobile-complete"
      title={t.title}
      onClick={handleToggleComplete}
      disabled={!hasPermission || recording || busy || importexportBusy}
      startIcon={
        complete ? (
          <CompleteIcon id="step-yes" sx={{ color: 'black' }} />
        ) : (
          <NotCompleteIcon id="step-no" />
        )
      }
      sx={{
        minWidth: 0,
        maxWidth: '100%',
        '@media (max-width:405px)': { px: 1 },
      }}
    >
      <Box
        component="span"
        sx={{
          display: 'block',
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {t.title}
      </Box>
    </Button>
  );
}
