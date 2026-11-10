import { OrgWorkflowStepD, StepComplete } from '../model';

/** The parts of an org workflow step that stepsCompleteThrough reads. */
export type StepCompleteSource = Pick<OrgWorkflowStepD, 'id'> & {
  attributes: Pick<OrgWorkflowStepD['attributes'], 'sequencenum' | 'name'>;
};

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
 * Returns undefined when `stepId` is not one of `steps`, so the caller skips
 * the write instead of saving an empty list that clears every step.
 */
export function stepsCompleteThrough(
  steps: StepCompleteSource[],
  stepId: string,
  remIdOf: (id: string) => string
): StepComplete[] | undefined {
  if (!steps.some((s) => s.id === stepId)) return undefined;
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
