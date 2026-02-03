import { useMemo } from 'react';
import { useOrbitData } from '../hoc/useOrbitData';
import { OrganizationD } from '../model';
import { isPersonalTeam, useRole } from '../crud';

export const useAdminTeams = () => {
  const organizations = useOrbitData<OrganizationD[]>('organization');
  const { userIsOrgAdmin } = useRole();
  const teams = useMemo(
    () =>
      organizations
        .filter((org) => !isPersonalTeam(org.id, organizations))
        .filter((org) => userIsOrgAdmin(org.id))
        .sort((a, b) =>
          (a.attributes.name || '') <= (b.attributes.name || '') ? -1 : 1
        ),
    [organizations, userIsOrgAdmin]
  );
  return teams;
};



