import Memory from '@orbit/memory';
import { Organization } from '../model';
import { related } from '.';
import { findRecords } from './tryFindRecord';

export function getOrgs(memory: Memory, currentUser: string): Organization[] {
  let orgs = findRecords(memory, 'organization');
  if (import.meta.env.VITE_MODE === 'electron') {
    const oms = findRecords(memory, 'organizationmembership');
    const userOrgIds = oms
      .filter((om) => related(om, 'user') === currentUser)
      .map((om) => related(om, 'organization')) as string[];
    orgs = orgs.filter((o) => userOrgIds.includes(o.id));
  }
  return orgs;
}
