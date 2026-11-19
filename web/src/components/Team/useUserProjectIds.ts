import { useMemo } from 'react';
import { GroupMembership, ProjectD } from '../../model';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useGlobal } from '../../context/useGlobal';
import { related } from '../../crud/related';

/**
 * Ids of the signed-in user's projects (those whose group the user belongs
 * to). Scopes the web Upload Pending badge and dialog, so another user's
 * recordings on a shared device are neither shown nor uploaded with this
 * user's token. Orbit can retain other users' records, so the whole project
 * table is not the user's scope (same filter as TeamContext `userProjects`).
 */
export function useUserProjectIds(): ReadonlySet<string> {
  const [user] = useGlobal('user');
  const projects = useOrbitData<ProjectD[]>('project');
  const groupMemberships = useOrbitData<GroupMembership[]>('groupmembership');
  return useMemo(() => {
    if (!user) return new Set<string>();
    const groupIds = new Set(
      groupMemberships
        .filter((gm) => related(gm, 'user') === user)
        .map((gm) => related(gm, 'group'))
    );
    return new Set(
      projects.filter((p) => groupIds.has(related(p, 'group'))).map((p) => p.id)
    );
  }, [user, projects, groupMemberships]);
}
