import { OrgWorkflowStepD } from '../model';
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
