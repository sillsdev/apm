import { OrganizationD } from '../model';

/**
 * Choose which personal organization id to treat as personalTeam when
 * duplicates exist. Prefer an org that already owns projects so Edit Workflow
 * and Home stay aligned with the user's data (TT-7397 hardening).
 * Falls back to newest by dateCreated.
 */
export function pickPersonalOrganizationId(
  personalOrgs: OrganizationD[],
  orgIdsWithProjects: ReadonlyArray<string>
): string | undefined {
  if (personalOrgs.length === 0) return undefined;
  const preferred = personalOrgs.find((o) => orgIdsWithProjects.includes(o.id));
  if (preferred) return preferred.id;
  const sorted = [...personalOrgs].sort((a, b) =>
    (b.attributes?.dateCreated ?? '').localeCompare(
      a.attributes?.dateCreated ?? ''
    )
  );
  return sorted[0]?.id;
}
