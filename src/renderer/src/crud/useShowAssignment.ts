import { useMemo } from 'react';
import { useGlobal } from '../context/useGlobal';
import { useOrbitData } from '../hoc/useOrbitData';
import { OrganizationD } from '../model';
import { isPersonalTeam } from './isPersonalTeam';

export function useShowAssignment(): boolean {
  const [team] = useGlobal('organization');
  const [offlineOnly] = useGlobal('offlineOnly');
  const teams = useOrbitData<OrganizationD[]>('organization');
  return useMemo(() => {
    if (offlineOnly) return false;
    const org = teams?.find((o) => o.id === team);
    if (!org) return false;
    return !isPersonalTeam(team, teams);
  }, [team, teams, offlineOnly]);
}
