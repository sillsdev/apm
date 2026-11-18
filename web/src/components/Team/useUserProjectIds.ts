import { useMemo } from 'react';
import { ProjectD } from '../../model';
import { useOrbitData } from '../../hoc/useOrbitData';

/**
 * Ids of the projects loaded for the signed-in user. Scopes the web Upload
 * Pending badge and dialog, so another user's recordings on a shared device
 * are neither shown nor uploaded with this user's token.
 */
export function useUserProjectIds(): ReadonlySet<string> {
  const projects = useOrbitData<ProjectD[]>('project');
  return useMemo(() => new Set(projects.map((p) => p.id)), [projects]);
}
