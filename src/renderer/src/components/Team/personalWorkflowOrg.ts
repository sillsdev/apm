import { VProjectD } from '../../model';
import related from '../../crud/related';

/**
 * Organization whose workflow the Personal "Edit Workflow" dialog should edit.
 * Prefer a personal project's organization when it differs from personalTeam
 * (duplicate / empty personal teams — TT-7397).
 */
export function personalWorkflowOrg(
  personalTeam: string,
  personalProjects: VProjectD[]
): string {
  for (const project of personalProjects) {
    const orgId = related(project, 'organization');
    if (typeof orgId === 'string' && orgId) return orgId;
  }
  return personalTeam;
}
