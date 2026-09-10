import { OrganizationD } from '../model';

export type PickPersonalOrganizationOptions = {
  /**
   * When true, only orgs with a cloud identity (keys.remoteId).
   * When false, only orgs without a cloud identity.
   * When omitted, all personal orgs are considered (legacy — not ADR 0012).
   */
  requireCloudIdentity?: boolean;
};

/**
 * Choose which personal organization id to treat as personalTeam when
 * duplicates exist. Prefer the oldest by dateCreated so the choice is stable
 * (TT-7397 / ADR 0012).
 */
export function pickPersonalOrganizationId(
  personalOrgs: OrganizationD[],
  options?: PickPersonalOrganizationOptions
): string | undefined {
  void options; // TODO ADR 0012: filter by requireCloudIdentity
  if (personalOrgs.length === 0) return undefined;
  const sorted = [...personalOrgs].sort((a, b) =>
    (a.attributes?.dateCreated ?? '').localeCompare(
      b.attributes?.dateCreated ?? ''
    )
  );
  return sorted[0]?.id;
}
