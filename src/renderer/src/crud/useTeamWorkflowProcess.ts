import { useMemo } from 'react';
import { useGetGlobal } from '../context/useGlobal';
import { OrgWorkflowStepD } from '../model';
import { related } from './related';
import { useOrbitData } from '../hoc/useOrbitData';

/** Process id for Basic Oral Language Documentation teams. */
export const BOLD_WORKFLOW_PROCESS = 'bold';

/**
 * Returns the `process` value from the first org workflow step for a team,
 * or undefined when unknown (e.g. no steps yet).
 */
export const useTeamWorkflowProcess = (teamId: string | undefined) => {
  const steps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const getGlobal = useGetGlobal();

  return useMemo(() => {
    if (!teamId) return undefined;
    const offlineOnly = getGlobal('offlineOnly');
    const orgSteps = steps
      .filter(
        (s) =>
          related(s, 'organization') === teamId &&
          Boolean(s.keys?.remoteId) !== offlineOnly
      )
      .sort((a, b) => a.attributes.sequencenum - b.attributes.sequencenum);
    return orgSteps[0]?.attributes?.process;
  }, [teamId, steps, getGlobal]);
};
