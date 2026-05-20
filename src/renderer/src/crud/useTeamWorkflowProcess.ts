import { useMemo } from 'react';
import { useGlobal } from '../context/useGlobal';
import { OrgWorkflowStepD } from '../model';
import { related } from './related';
import { useOrbitData } from '../hoc/useOrbitData';

/** Process id for Basic Oral Language Documentation teams. */
export const BOLD_WORKFLOW_PROCESS = 'bold';

/** True when the team's workflow process is BOLD. */
export const isBoldTeamWorkflow = (
  process: string | undefined
): boolean => process === BOLD_WORKFLOW_PROCESS;

/**
 * Returns the `process` value from the first org workflow step for a team,
 * or undefined when unknown (e.g. no steps yet).
 */
export const useTeamWorkflowProcess = (teamId: string | undefined) => {
  const steps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const [offlineOnly] = useGlobal('offlineOnly');

  return useMemo(() => {
    if (!teamId) return undefined;
    const orgSteps = steps
      .filter(
        (s) =>
          related(s, 'organization') === teamId &&
          Boolean(s.keys?.remoteId) !== offlineOnly
      )
      .sort((a, b) => a.attributes.sequencenum - b.attributes.sequencenum);
    return orgSteps[0]?.attributes?.process;
  }, [teamId, steps, offlineOnly]);
};
