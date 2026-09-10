import { OrganizationD } from '../model';
import { pickPersonalOrganizationId } from './pickPersonalOrganizationId';

const personalOrg = (
  id: string,
  dateCreated: string
): OrganizationD =>
  ({
    id,
    type: 'organization',
    attributes: {
      name: `>User Personal<`,
      dateCreated,
    },
  }) as OrganizationD;

describe('pickPersonalOrganizationId', () => {
  it('prefers the personal org that already owns projects (TT-7397)', () => {
    const olderWithProject = personalOrg('org-with-project', '2024-01-01');
    const newerEmpty = personalOrg('org-empty-newer', '2025-06-01');
    expect(
      pickPersonalOrganizationId(
        [newerEmpty, olderWithProject],
        ['org-with-project']
      )
    ).toBe('org-with-project');
  });

  it('falls back to newest by dateCreated when none own projects', () => {
    const older = personalOrg('org-old', '2024-01-01');
    const newer = personalOrg('org-new', '2025-06-01');
    expect(pickPersonalOrganizationId([older, newer], [])).toBe('org-new');
  });

  it('returns undefined when there are no personal orgs', () => {
    expect(pickPersonalOrganizationId([], ['org-x'])).toBeUndefined();
  });
});
