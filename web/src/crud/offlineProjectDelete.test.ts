import MemorySource from '@orbit/memory';
import { schema } from '../schema';
import { offlineProjectIdsForDeleted } from './offlineProjectDelete';

function rel(type: string, id: string) {
  return { data: { type, id } };
}

async function seed(memory: MemorySource) {
  await memory.update((t) => [
    t.addRecord({
      type: 'user',
      id: 'me',
      attributes: { name: 'Me' },
    }),
    t.addRecord({
      type: 'organization',
      id: 'org1',
      attributes: { name: 'Team' },
    }),
    t.addRecord({
      type: 'project',
      id: 'p1',
      attributes: { name: 'P1' },
      relationships: { organization: rel('organization', 'org1') },
    }),
    t.addRecord({
      type: 'project',
      id: 'p-unlinked',
      attributes: { name: 'No team' },
    }),
    t.addRecord({
      type: 'organizationmembership',
      id: 'om-blank',
      attributes: {},
      relationships: { user: rel('user', 'me') },
    }),
    t.addRecord({
      type: 'organizationmembership',
      id: 'om-me',
      attributes: {},
      relationships: {
        user: rel('user', 'me'),
        organization: rel('organization', 'org1'),
      },
    }),
  ]);
}

describe('offlineProjectIdsForDeleted', () => {
  it('does not treat a missing team link as every project', async () => {
    const memory = new MemorySource({ schema });
    await seed(memory);
    expect(
      offlineProjectIdsForDeleted(
        memory,
        'me',
        'organizationmembership',
        'om-blank'
      )
    ).toEqual([]);
  });

  it('returns only the team projects for the current user', async () => {
    const memory = new MemorySource({ schema });
    await seed(memory);
    expect(
      offlineProjectIdsForDeleted(
        memory,
        'me',
        'organizationmembership',
        'om-me'
      )
    ).toEqual(['p1']);
  });
});
