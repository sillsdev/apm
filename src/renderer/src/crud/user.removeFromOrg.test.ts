jest.mock('../utils', () => ({
  localeDefault: () => 'en',
}));
jest.mock('../store', () => ({
  setLanguage: jest.fn(),
}));
jest.mock('.', () => ({
  related: (rec: any, key: string) => {
    const data = rec?.relationships?.[key]?.data;
    if (!data || Array.isArray(data)) return data ?? null;
    return data.id ?? null;
  },
}));

import MemorySource from '@orbit/memory';
import { schema } from '../schema';
import { RemoveUserFromOrg } from './user';

async function seed(memory: MemorySource, invitationAttributes?: object) {
  await memory.update((t) => [
    t.addRecord({
      type: 'user',
      id: 'me',
      attributes: { name: 'Me', email: 'me@example.com' },
    }),
    t.addRecord({
      type: 'user',
      id: 'admin',
      attributes: { name: 'Admin', email: 'admin@example.com' },
    }),
    t.addRecord({
      type: 'organization',
      id: 'org1',
      attributes: { name: 'Team' },
    }),
    t.addRecord({
      type: 'role',
      id: 'member',
      attributes: { roleName: 'Member', orgRole: true },
    }),
    t.addRecord({
      type: 'organizationmembership',
      id: 'om-me',
      attributes: {},
      relationships: {
        user: { data: { type: 'user', id: 'me' } },
        organization: { data: { type: 'organization', id: 'org1' } },
        role: { data: { type: 'role', id: 'member' } },
      },
    }),
    t.addRecord({
      type: 'organizationmembership',
      id: 'om-admin',
      attributes: {},
      relationships: {
        user: { data: { type: 'user', id: 'admin' } },
        organization: { data: { type: 'organization', id: 'org1' } },
        role: { data: { type: 'role', id: 'member' } },
      },
    }),
    t.addRecord({
      type: 'group',
      id: 'g1',
      attributes: { name: 'All', allUsers: true },
      relationships: {
        owner: { data: { type: 'organization', id: 'org1' } },
      },
    }),
    t.addRecord({
      type: 'groupmembership',
      id: 'gm-me',
      attributes: {},
      relationships: {
        user: { data: { type: 'user', id: 'me' } },
        group: { data: { type: 'group', id: 'g1' } },
      },
    }),
    t.addRecord({
      type: 'project',
      id: 'p1',
      attributes: { name: 'P' },
      relationships: {
        organization: { data: { type: 'organization', id: 'org1' } },
        group: { data: { type: 'group', id: 'g1' } },
      },
    }),
    t.addRecord({
      type: 'plan',
      id: 'plan1',
      attributes: { name: 'Plan' },
      relationships: {
        project: { data: { type: 'project', id: 'p1' } },
      },
    }),
    t.addRecord({
      type: 'section',
      id: 's1',
      attributes: { name: 'S', sequencenum: 1 },
      relationships: {
        plan: { data: { type: 'plan', id: 'plan1' } },
        transcriber: { data: { type: 'user', id: 'me' } },
      },
    }),
    t.addRecord({
      type: 'invitation',
      id: 'inv1',
      ...(invitationAttributes ? { attributes: invitationAttributes } : {}),
      relationships: {
        organization: { data: { type: 'organization', id: 'org1' } },
      },
    } as any),
  ]);
}

async function removeMe(memory: MemorySource) {
  const me = memory.cache.query((q) =>
    q.findRecord({ type: 'user', id: 'me' })
  ) as Parameters<typeof RemoveUserFromOrg>[1];
  await RemoveUserFromOrg(memory, me, 'org1', 'me', jest.fn());
}

describe('RemoveUserFromOrg self-delete', () => {
  it('removes the current member membership', async () => {
    const memory = new MemorySource({ schema });
    await seed(memory, { email: 'me@example.com' });
    await removeMe(memory);
    const memberships = memory.cache.query((q) =>
      q.findRecords('organizationmembership')
    ) as { id: string }[];
    expect(memberships.map((m) => m.id)).toEqual(['om-admin']);
  });

  it('rejects when orphan team deletion fails', async () => {
    const memory = new MemorySource({ schema });
    await seed(memory, { email: 'me@example.com' });
    await memory.update((t) =>
      t.removeRecord({ type: 'organizationmembership', id: 'om-admin' })
    );
    const me = memory.cache.query((q) =>
      q.findRecord({ type: 'user', id: 'me' })
    ) as Parameters<typeof RemoveUserFromOrg>[1];
    const teamDelete = jest
      .fn()
      .mockRejectedValue(new Error('backup sync failed'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(
      RemoveUserFromOrg(memory, me, 'org1', 'me', teamDelete)
    ).rejects.toThrow('backup sync failed');
    expect(teamDelete).toHaveBeenCalledWith('org1');
    errorSpy.mockRestore();
  });

  it('rejects a failed membership update and removes the member on retry', async () => {
    const memory = new MemorySource({ schema });
    await seed(memory, { email: 'me@example.com' });
    const me = memory.cache.query((q) =>
      q.findRecord({ type: 'user', id: 'me' })
    ) as Parameters<typeof RemoveUserFromOrg>[1];
    const teamDelete = jest.fn();
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const update = jest
      .spyOn(memory, 'update')
      .mockRejectedValueOnce(new Error('update failed'));
    const membershipIds = () =>
      (
        memory.cache.query((q) => q.findRecords('organizationmembership')) as {
          id: string;
        }[]
      )
        .map((m) => m.id)
        .sort();
    try {
      await expect(
        RemoveUserFromOrg(memory, me, 'org1', 'me', teamDelete)
      ).rejects.toThrow('update failed');
      expect(teamDelete).not.toHaveBeenCalled();
      expect(membershipIds()).toEqual(['om-admin', 'om-me']);

      update.mockRestore();
      await RemoveUserFromOrg(memory, me, 'org1', 'me', jest.fn());
      expect(membershipIds()).toEqual(['om-admin']);
    } finally {
      update.mockRestore();
      errorSpy.mockRestore();
    }
  });

  it('still removes membership when an invitation has no attributes', async () => {
    const memory = new MemorySource({ schema });
    await seed(memory);
    await removeMe(memory);
    const memberships = memory.cache.query((q) =>
      q.findRecords('organizationmembership')
    ) as { id: string }[];
    expect(memberships.map((m) => m.id)).toEqual(['om-admin']);
  });
});
