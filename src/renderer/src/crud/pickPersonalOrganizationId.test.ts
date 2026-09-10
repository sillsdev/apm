import { expect, describe, it } from '@jest/globals';
import { OrganizationD } from '../model';
import { pickPersonalOrganizationId } from './pickPersonalOrganizationId';

const personalOrg = (id: string, dateCreated: string): OrganizationD =>
  ({
    id,
    type: 'organization',
    attributes: {
      name: `>User Personal<`,
      dateCreated,
    },
  }) as OrganizationD;

describe('pickPersonalOrganizationId', () => {
  it('picks the oldest personal org by dateCreated when no cloud-identity filter', () => {
    const older = personalOrg('org-old', '2024-01-01');
    const newer = personalOrg('org-new', '2025-06-01');
    expect(pickPersonalOrganizationId([newer, older])).toBe('org-old');
  });

  it('returns the only personal org when there is one', () => {
    const only = personalOrg('org-only', '2024-01-01');
    expect(pickPersonalOrganizationId([only])).toBe('org-only');
  });

  it('returns undefined when there are no personal orgs', () => {
    expect(pickPersonalOrganizationId([])).toBeUndefined();
  });
});
