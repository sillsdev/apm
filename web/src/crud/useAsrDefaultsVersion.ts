import { useMemo } from 'react';
import { useGlobal } from '../context/useGlobal';
import { useOrbitData } from '../hoc/useOrbitData';
import { OrganizationD, ProjectD } from '../model';
import { useJsonParams } from '../utils/useJsonParams';
import { orgDefaultAsr, orgDefaultLangProps } from './useOrgDefaults';

/**
 * Changes whenever a saved default that ASR resolution reads changes: the team
 * ASR and team language, and the project's own ASR choice. Orbit mutates those
 * records in place, so getOrgDefault/getProjectDefault keep their identity;
 * list this in a loader's dependencies so it reloads ASR settings after a save.
 * Other saved defaults (filters, recommendations) leave it unchanged.
 */
export function useAsrDefaultsVersion(orgId?: string): string {
  const [organization] = useGlobal('organization');
  const [project] = useGlobal('project');
  const teams = useOrbitData<OrganizationD[]>('organization');
  const projects = useOrbitData<ProjectD[]>('project');
  const { getParam } = useJsonParams();
  const teamId = orgId ?? organization;
  const teamParams = useMemo(
    () => teams.find((o) => o.id === teamId)?.attributes?.defaultParams,
    [teams, teamId]
  );
  const projectParams = useMemo(
    () => projects.find((p) => p.id === project)?.attributes?.defaultParams,
    [projects, project]
  );
  return useMemo(
    () =>
      JSON.stringify([
        getParam(orgDefaultAsr, teamParams),
        getParam(orgDefaultLangProps, teamParams),
        getParam(orgDefaultAsr, projectParams),
      ]),
    [getParam, teamParams, projectParams]
  );
}
