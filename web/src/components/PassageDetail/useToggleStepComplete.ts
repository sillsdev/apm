import { useCallback, useContext, useMemo, useRef } from 'react';
import usePassageDetailContext from '../../context/usePassageDetailContext';
import { UnsavedContext } from '../../context/UnsavedContext';
import { ToolSlug, useStepTool } from '../../crud';
import { useSnackBar } from '../../hoc/SnackBar';
import { completeStepAfterSave } from '../../context/completeStepAfterSave';
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
      // Save and step-write failures are shown inside; a gotoNextStep error
      // still rejects, so a navigation bug surfaces instead of being hidden.
      await completeStepAfterSave({
        stepId: currentstep,
        complete: !wasComplete,
        waitForSaves: async () => {
          // Mark Verses keeps edits until saved; save them before completing.
          if (wasComplete || tool !== ToolSlug.Verses) return;
          if (!isChanged(verseToolId)) return;
          startSave(verseToolId);
          await waitForSave(undefined, 25);
        },
        setStepComplete,
        showMessage,
        onDone: wasComplete ? undefined : gotoNextStep,
      });
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
