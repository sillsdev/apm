import { VProjectD } from '../../model';

/**
 * Organization whose workflow the Personal "Edit Workflow" dialog should edit.
 * Always the canonical personalTeam (Personal Team or Work Alone Team) — ADR 0012.
 */
export function personalWorkflowOrg(
  personalTeam: string,
  _personalProjects: VProjectD[]
): string {
  return personalTeam;
}
