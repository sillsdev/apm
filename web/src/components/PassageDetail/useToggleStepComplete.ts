import { useCallback, useContext, useMemo, useRef } from 'react';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import { UnsavedContext } from '../../context/UnsavedContext';
import { ToolSlug, useStepTool } from '../../crud';
import { useSnackBar } from '../../hoc/SnackBar';
import { errorMessage } from '../../utils/toError';
import { verseToolId } from './markVersesTool';

/**
 * The current step's complete flag and the toggle behind the desktop and
 * mobile step-complete controls.
 *
 * Marking complete saves pending Mark Verses edits first, then moves on to the
 * next step or passage. A second click while a toggle is still running is
 * ignored: `complete` only changes once the save lands, so it would otherwise
 * repeat the write and call gotoNextStep twice, skipping a step.
 */
export function useToggleStepComplete() {
  const {
    currentstep,
    stepComplete,
    setStepComplete,
    gotoNextStep,
    psgCompleted,
  } = usePassageDetailContext();
  const { tool } = useStepTool(currentstep);
  const { isChanged, startSave, waitForSave } =
    useContext(UnsavedContext).state;
  const { showMessage } = useSnackBar();
  const toggling = useRef(false);

  const complete = useMemo(
    () => stepComplete(currentstep),
    // stepComplete is recreated every provider render; psgCompleted is the
    // value it actually reads, so it stands in for it here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentstep, psgCompleted]
  );

  const toggleComplete = useCallback(async () => {
    if (toggling.current) return;
    toggling.current = true;
    const wasComplete = complete;
    try {
      if (!wasComplete && tool === ToolSlug.Verses && isChanged(verseToolId)) {
        startSave(verseToolId);
        try {
          await waitForSave(undefined, 25);
        } catch (err: unknown) {
          const message = errorMessage(err);
          if (message) showMessage(message);
          return;
        }
      }
      await setStepComplete(currentstep, !wasComplete);
      if (!wasComplete) gotoNextStep();
    } catch {
      // setStepComplete already logged and showed the failure; stay on this step
    } finally {
      toggling.current = false;
    }
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

  return { complete, toggleComplete };
}
