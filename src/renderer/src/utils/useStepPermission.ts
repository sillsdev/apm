import { useCallback, useEffect, useState } from 'react';
import { usePeerGroups } from '../components/Peers/usePeerGroups';
import { useGlobal } from '../context/useGlobal';
import { useRole } from '../crud/useRole';
import { findRecord } from '../crud/tryFindRecord';
import { orgDefaultPermissions, useOrgDefaults } from '../crud/useOrgDefaults';
import { related } from '../crud/related';
import { useOrbitData } from '../hoc/useOrbitData';
import { OrganizationD, OrgWorkflowStepD, SectionD } from '../model';
import OrganizationSchemeStepD from '../model/organizationSchemeStep';

interface StepPermissionResult {
  canDoVernacular: (sectionId: string) => boolean;
  canDoSectionStep: (stepId: string, section: SectionD) => boolean;
  canAlwaysDoStep: () => boolean;
}

export const useStepPermissions = (): StepPermissionResult => {
  const [memory] = useGlobal('memory');
  const [user] = useGlobal('user');
  const { userIsAdmin } = useRole();
  // default to true so canDOSectionStep doesn't falsely return true
  const [permissionsOn, setPermissionsOn] = useState(true);
  const { myGroups } = usePeerGroups();
  const { getOrgDefault } = useOrgDefaults();
  const [org] = useGlobal('organization');
  const orgsteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  const steps = useOrbitData<OrganizationSchemeStepD[]>(
    'organizationschemestep'
  );
  const organizations = useOrbitData<OrganizationD[]>('organization');

  useEffect(() => {
    const on = Boolean(getOrgDefault(orgDefaultPermissions));
    setPermissionsOn(on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizations]);

  const canAlwaysDoStep = useCallback(
    () => userIsAdmin || !permissionsOn,
    [permissionsOn, userIsAdmin]
  );

  const canDoSectionStep = (stepId: string, section: SectionD): boolean => {
    if (canAlwaysDoStep()) return true;
    const scheme = related(section, 'organizationScheme');
    if (!scheme) return true;
    const assigned = steps.find(
      (s: OrganizationSchemeStepD) =>
        related(s, 'organizationscheme') === scheme &&
        related(s, 'orgWorkflowStep') === stepId
    );
    if (!assigned) return true;
    const assignedgroup = related(assigned as OrgWorkflowStepD, 'group');
    const assigneduser = related(assigned as OrgWorkflowStepD, 'user');
    return (
      ((Boolean(assignedgroup) &&
        myGroups.findIndex((g) => g.id === assignedgroup) > -1) ||
        (Boolean(assigneduser) && assigneduser === user)) ??
      false
    );
  };

  const canDoStep = (stepId: string, sectionId: string): boolean => {
    if (canAlwaysDoStep()) return true;
    return canDoSectionStep(
      stepId,
      findRecord(memory, 'section', sectionId) as SectionD
    );
  };

  const canDoVernacular = (sectionId: string): boolean => {
    if (canAlwaysDoStep()) return true;
    const step = orgsteps.find(
      (s) =>
        related(s, 'organization') === org &&
        /"tool":\s*"record"/.test(s.attributes.tool)
    );
    if (!step?.id) return false;
    return canDoStep(step.id, sectionId);
  };
  return { canDoVernacular, canDoSectionStep, canAlwaysDoStep };
};
