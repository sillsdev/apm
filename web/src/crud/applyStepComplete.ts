import { StepComplete } from '../model';

/** Immutable update of one step in the passage completed list. */
export function applyStepComplete(
  completed: StepComplete[],
  remId: string,
  complete: boolean,
  name: string
): StepComplete[] {
  const idx = completed.findIndex((s) => s.stepid === remId);
  if (idx >= 0) {
    const cur = completed[idx];
    if (cur.complete === complete && cur.name === name) return completed;
    const next = completed.slice();
    next[idx] = { ...cur, complete, name };
    return next;
  }
  return [...completed, { stepid: remId, complete, name }];
}

/**
 * Mark every org workflow step through `stepId` (inclusive) complete.
 * Returns [] when `stepId` is not one of `steps`.
 */
export function stepsCompleteThrough(
  steps: {
    id: string;
    attributes: { sequencenum: number; name: string };
  }[],
  stepId: string,
  remIdOf: (id: string) => string
): StepComplete[] {
  if (!steps.some((s) => s.id === stepId)) return [];
  const sorted = [...steps].sort(
    (a, b) => a.attributes.sequencenum - b.attributes.sequencenum
  );
  const completed: StepComplete[] = [];
  for (const step of sorted) {
    completed.push({
      stepid: remIdOf(step.id),
      complete: true,
      name: step.attributes.name,
    });
    if (step.id === stepId) break;
  }
  return completed;
}
