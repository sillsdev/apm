/**
 * Returns true when navigating away should prompt because the user is leaving an
 * incomplete step for another incomplete step.
 */
export function needsStepNavigationConfirm(
  fromStepId: string,
  toStepId: string,
  isStepComplete: (stepId: string) => boolean
): boolean {
  if (!fromStepId || !toStepId || fromStepId === toStepId) {
    return false;
  }
  if (isStepComplete(fromStepId)) {
    return false;
  }
  if (isStepComplete(toStepId)) {
    return false;
  }
  return true;
}
