import { OrganizationD } from '../model';

/**
 * Choose which personal organization id to treat as personalTeam when
 * duplicates exist. Prefer the oldest by dateCreated so the choice is stable
 * (TT-7397).
 */
export function pickPersonalOrganizationId(
  personalOrgs: OrganizationD[]
): string | undefined {
  if (personalOrgs.length === 0) return undefined;
  const sorted = [...personalOrgs].sort((a, b) =>
    (a.attributes?.dateCreated ?? '').localeCompare(
      b.attributes?.dateCreated ?? ''
    )
  );
  return sorted[0]?.id;
}
