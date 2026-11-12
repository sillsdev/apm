import { OrganizationD } from '../model';
import { pickPersonalOrganizationId } from './pickPersonalOrganizationId';

export type CanonicalPersonalTeamOptions = {
  /** Work Alone mode → no cloud identity; otherwise require cloud identity. */
  offlineOnly: boolean;
};

/**
 * Resolve the canonical Personal Team or Work Alone Team id (ADR 0012).
 * Personal Team: oldest owned personal-named org with cloud identity.
 * Work Alone Team: oldest owned personal-named org without cloud identity.
 */
export function resolveCanonicalPersonalTeamId(
  personalOrgs: OrganizationD[],
  { offlineOnly }: CanonicalPersonalTeamOptions
): string | undefined {
  const requireCloudIdentity = !offlineOnly;
  return pickPersonalOrganizationId(personalOrgs, { requireCloudIdentity });
}

export type SeedOrgWorkflowStepsGate = {
  loadComplete: boolean;
  queuesIdle: boolean;
  createLockHeld: boolean;
  requeryEmpty: boolean;
};

/**
 * Whether it is safe to seed org workflow steps from process templates (ADR 0012).
 * Must not seed while data is still loading — that created duplicate steps.
 */
export function shouldSeedOrgWorkflowSteps(
  gate: SeedOrgWorkflowStepsGate
): boolean {
  return (
    gate.loadComplete &&
    gate.queuesIdle &&
    gate.createLockHeld &&
    gate.requeryEmpty
  );
}

/**
 * Org whose workflow steps to show for a project on a personal-named team (ADR 0012).
 * Remap to the canonical team when the project's org is personal-named; otherwise
 * leave the project's organization as-is (shared team projects).
 */
export function workflowOrgForPersonalNamedProject(
  projectOrganizationId: string,
  canonicalPersonalTeamId: string,
  projectOrganizationIsPersonalNamed: boolean
): string {
  if (projectOrganizationIsPersonalNamed) return canonicalPersonalTeamId;
  return projectOrganizationId;
}
