import { expect, describe, it } from '@jest/globals';
import { OrganizationD, VProjectD } from '../model';
import { pickPersonalOrganizationId } from './pickPersonalOrganizationId';
import {
  resolveCanonicalPersonalTeamId,
  shouldSeedOrgWorkflowSteps,
  workflowOrgForPersonalNamedProject,
} from './canonicalPersonalWorkflow';
import { personalWorkflowOrg } from '../components/Team/personalWorkflowOrg';

const personalOrg = (
  id: string,
  dateCreated: string,
  remoteId?: string
): OrganizationD =>
  ({
    id,
    type: 'organization',
    attributes: {
      name: `>User Personal<`,
      dateCreated,
    },
    ...(remoteId ? { keys: { remoteId } } : {}),
  }) as OrganizationD;

const projectOn = (orgId: string): VProjectD =>
  ({
    id: `plan-${orgId}`,
    type: 'plan',
    relationships: {
      organization: { data: { type: 'organization', id: orgId } },
    },
  }) as VProjectD;

/**
 * ADR 0012 — Canonical personal workflow teams.
 * These tests encode the accepted product rules. Failures show what production
 * helpers still need to change.
 */
describe('ADR 0012 canonical personal workflow teams', () => {
  describe('Personal Team vs Work Alone Team selection', () => {
    const cloudOlder = personalOrg('cloud-old', '2023-01-01', 'remote-1');
    const cloudNewer = personalOrg('cloud-new', '2025-01-01', 'remote-2');
    const localOlder = personalOrg('local-old', '2022-01-01');
    const localNewer = personalOrg('local-new', '2024-06-01');
    const mixed = [cloudNewer, localNewer, cloudOlder, localOlder];

    it('Personal Team is the oldest personal org with a cloud identity', () => {
      expect(
        pickPersonalOrganizationId(mixed, { requireCloudIdentity: true })
      ).toBe('cloud-old');
    });

    it('Work Alone Team is the oldest personal org without a cloud identity', () => {
      expect(
        pickPersonalOrganizationId(mixed, { requireCloudIdentity: false })
      ).toBe('local-old');
    });

    it('does not mix cloud and local pools when resolving Personal Team', () => {
      expect(
        pickPersonalOrganizationId(mixed, { requireCloudIdentity: true })
      ).not.toBe('local-old');
    });

    it('Work Alone mode resolves Work Alone Team (no cloud identity)', () => {
      expect(resolveCanonicalPersonalTeamId(mixed, { offlineOnly: true })).toBe(
        'local-old'
      );
    });

    it('non–Work Alone mode resolves Personal Team (cloud identity)', () => {
      expect(
        resolveCanonicalPersonalTeamId(mixed, { offlineOnly: false })
      ).toBe('cloud-old');
    });

    it('returns undefined when the required pool is empty', () => {
      expect(
        pickPersonalOrganizationId([localOlder], { requireCloudIdentity: true })
      ).toBeUndefined();
      expect(
        pickPersonalOrganizationId([cloudOlder], {
          requireCloudIdentity: false,
        })
      ).toBeUndefined();
    });
  });

  describe('Edit Workflow targets the canonical team', () => {
    it('uses canonical personalTeam even when a project hangs off a duplicate', () => {
      const canonical = 'canonical-work-alone';
      const duplicateWithSteps = 'duplicate-with-steps';
      expect(
        personalWorkflowOrg(canonical, [projectOn(duplicateWithSteps)])
      ).toBe(canonical);
    });

    it('falls back to personalTeam when there are no personal projects', () => {
      expect(personalWorkflowOrg('canonical-team', [])).toBe('canonical-team');
    });
  });

  describe('in-project workflow remap for personal-named orgs', () => {
    it('remaps a personal-named project org to the canonical team', () => {
      expect(
        workflowOrgForPersonalNamedProject(
          'duplicate-org',
          'canonical-org',
          true
        )
      ).toBe('canonical-org');
    });

    it('leaves a shared (non-personal) team project org unchanged', () => {
      expect(
        workflowOrgForPersonalNamedProject(
          'shared-team',
          'canonical-org',
          false
        )
      ).toBe('shared-team');
    });
  });

  describe('seed-from-templates gate', () => {
    const ready = {
      loadComplete: true,
      queuesIdle: true,
      createLockHeld: true,
      requeryEmpty: true,
    };

    it('seeds only when load is complete, queues idle, lock held, and re-query empty', () => {
      expect(shouldSeedOrgWorkflowSteps(ready)).toBe(true);
    });

    it('does not seed while load is incomplete (avoids duplicate steps)', () => {
      expect(
        shouldSeedOrgWorkflowSteps({ ...ready, loadComplete: false })
      ).toBe(false);
    });

    it('does not seed while queues are busy', () => {
      expect(shouldSeedOrgWorkflowSteps({ ...ready, queuesIdle: false })).toBe(
        false
      );
    });

    it('does not seed without the create lock', () => {
      expect(
        shouldSeedOrgWorkflowSteps({ ...ready, createLockHeld: false })
      ).toBe(false);
    });

    it('does not seed when re-query finds existing steps', () => {
      expect(
        shouldSeedOrgWorkflowSteps({ ...ready, requeryEmpty: false })
      ).toBe(false);
    });
  });
});
