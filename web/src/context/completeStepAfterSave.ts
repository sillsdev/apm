import { errorMessage } from '../utils/toError';

type SetStepComplete = (stepId: string, complete: boolean) => Promise<void>;

/**
 * Run setStepComplete and say whether the write landed. setStepComplete has
 * already logged and shown a failure, so callers only decide whether to go on.
 */
export async function trySetStepComplete(
  setStepComplete: SetStepComplete,
  stepId: string,
  complete: boolean
): Promise<boolean> {
  try {
    await setStepComplete(stepId, complete);
    return true;
  } catch {
    return false;
  }
}

export interface CompleteStepAfterSaveOptions {
  stepId: string;
  complete: boolean;
  /** Waits for the tool's pending saves; rejects if a save failed or timed out. */
  waitForSaves: () => Promise<unknown>;
  /** The context's setStepComplete; it reports its own failures, then rejects. */
  setStepComplete: SetStepComplete;
  showMessage: (message: string) => void;
  /** Runs only once the step is saved, e.g. gotoNextStep. */
  onDone?: () => void;
}

/**
 * Wait for pending tool saves, then mark the step, then run `onDone`.
 *
 * A failed or timed-out save is shown and stops here, so a step is never
 * marked complete over unsaved work. A failed step write was already logged
 * and shown by setStepComplete, so it only stops here. Neither rejects: the
 * returned promise rejects only if `onDone` itself throws, which is a bug that
 * should surface rather than be swallowed.
 */
export async function completeStepAfterSave({
  stepId,
  complete,
  waitForSaves,
  setStepComplete,
  showMessage,
  onDone,
}: CompleteStepAfterSaveOptions): Promise<void> {
  try {
    await waitForSaves();
  } catch (err: unknown) {
    const message = errorMessage(err);
    if (message) showMessage(message);
    return;
  }
  if (!(await trySetStepComplete(setStepComplete, stepId, complete))) return;
  onDone?.();
}
