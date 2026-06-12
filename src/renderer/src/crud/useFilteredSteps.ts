import { useMemo } from 'react';
import { useGlobal } from '../context/useGlobal';
import { OrgWorkflowStepD } from '../model';
import { usePlanType } from './usePlanType';
import { useOrbitData } from '../hoc/useOrbitData';
import { getTool } from './useStepTool';
import { ToolSlug } from './toolSlug';
import {
  filterAndSortOrgWorkflowSteps,
  filterVisibleOrgWorkflowSteps,
} from './orgWorkflowStepsUtils';

const filterOrgStepsForPlanType = (
  steps: OrgWorkflowStepD[],
  scripture: boolean
): OrgWorkflowStepD[] =>
  steps.filter(
    (s) =>
      scripture ||
      ![ToolSlug.Paratext, ToolSlug.Verses].includes(
        getTool(s.attributes?.tool)
      )
  );

/** Stable key for step list identity; ignores Orbit array reference churn. */
export const orgWorkflowStepsFingerprint = (
  steps: OrgWorkflowStepD[]
): string =>
  steps
    .map(
      (s) =>
        `${s.id}\0${s.attributes.sequencenum}\0${s.attributes.name}\0${s.attributes.tool}`
    )
    .join('|');

/** Org workflow steps for the current plan/org, filtered and sorted for UI use. */
export const useFilteredSteps = (): OrgWorkflowStepD[] => {
  const [plan] = useGlobal('plan');
  const [organization] = useGlobal('organization');
  const [offlineOnly] = useGlobal('offlineOnly');
  const getPlanType = usePlanType();
  const orgWorkflowSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');

  const filtered = useMemo(() => {
    const { scripture } = getPlanType(plan);
    const steps = filterVisibleOrgWorkflowSteps(
      filterAndSortOrgWorkflowSteps(
        orgWorkflowSteps,
        'ANY',
        organization,
        offlineOnly
      )
    );
    return filterOrgStepsForPlanType(steps, scripture);
  }, [orgWorkflowSteps, organization, offlineOnly, plan, getPlanType]);
  //filtered was churning and causing unnecessary re-renders
  const stepsKey = orgWorkflowStepsFingerprint(filtered);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => filtered, [stepsKey]);
};
