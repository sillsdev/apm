import { OrgWorkflowStepD, WorkflowStepD } from '../model';
import { related } from './related';

export const filterAndSortOrgWorkflowSteps = (
  orgworkflowsteps: OrgWorkflowStepD[],
  process: string,
  org: string,
  offlineOnly: boolean
): OrgWorkflowStepD[] =>
  orgworkflowsteps
    .filter(
      (s) =>
        (process === 'ANY' || s.attributes.process === process) &&
        related(s, 'organization') === org &&
        Boolean(s.keys?.remoteId) !== offlineOnly
    )
    .sort((i, j) => i.attributes.sequencenum - j.attributes.sequencenum);

/** Exclude admin-hidden steps (negative sequencenum) unless showAll. */
export const filterVisibleOrgWorkflowSteps = (
  steps: OrgWorkflowStepD[],
  showAll = false
): OrgWorkflowStepD[] =>
  steps.filter((s) => showAll || s.attributes.sequencenum >= 0);

/** Template workflowsteps used when creating org copies for a process. */
export const filterWorkflowStepTemplates = (
  workflowsteps: WorkflowStepD[],
  process: string,
  offlineOnly: boolean
): WorkflowStepD[] =>
  workflowsteps
    .filter(
      (s) =>
        s.attributes.process === process &&
        Boolean(s?.keys?.remoteId) !== offlineOnly
    )
    .sort((a, b) => a.attributes.sequencenum - b.attributes.sequencenum);

type MemoryCacheQuery = {
  cache: {
    query: (
      queryFn: (q: { findRecords: (type: string) => unknown }) => unknown
    ) => unknown;
  };
};

/**
 * Read workflowstep templates from Orbit cache at call time.
 * Avoids stale useOrbitData snapshots when CreateOrgWorkflowSteps runs
 * after offlineSetup has written templates (TT-7397 hardening).
 */
export const readWorkflowStepTemplates = (
  memory: MemoryCacheQuery,
  process: string,
  offlineOnly: boolean
): WorkflowStepD[] => {
  const steps = memory.cache.query((q) =>
    q.findRecords('workflowstep')
  ) as WorkflowStepD[];
  return filterWorkflowStepTemplates(steps, process, offlineOnly);
};
