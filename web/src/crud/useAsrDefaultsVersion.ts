import { useMemo } from 'react';
import { useGlobal } from '../context/useGlobal';
import { useOrbitData } from '../hoc/useOrbitData';
import { OrganizationD, ProjectD } from '../model';

/**
 * Changes whenever the team or project saved defaults change (team ASR, team
 * language, the project's own ASR choice). Orbit mutates those records in
 * place, so getOrgDefault/getProjectDefault keep their identity; list this in
 * a loader's dependencies so it reloads ASR settings after a save.
 */
export function useAsrDefaultsVersion(orgId?: string): string {
  const [organization] = useGlobal('organization');
  const [project] = useGlobal('project');
  const teams = useOrbitData<OrganizationD[]>('organization');
  const projects = useOrbitData<ProjectD[]>('project');
  const teamId = orgId ?? organization;
  const teamParams = useMemo(
    () => teams.find((o) => o.id === teamId)?.attributes?.defaultParams ?? '',
    [teams, teamId]
  );
  const projectParams = useMemo(
    () =>
      projects.find((p) => p.id === project)?.attributes?.defaultParams ?? '',
    [projects, project]
  );
  return `${teamParams}\n${projectParams}`;
}
