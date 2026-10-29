jest.mock('../utils/axios', () => ({ axiosGet: jest.fn() }));
jest.mock('../utils', () => ({
  logError: jest.fn(),
  Severity: { error: 'error' },
}));
jest.mock('../store', () => ({}));
jest.mock('../crud', () => {
  const { related } =
    jest.requireActual<typeof import('../crud/related')>('../crud/related');
  const { findRecord } = jest.requireActual<
    typeof import('../crud/tryFindRecord')
  >('../crud/tryFindRecord');
  const { remoteId, remoteIdGuid } =
    jest.requireActual<typeof import('../crud/remoteId')>('../crud/remoteId');
  return {
    related,
    findRecord,
    remoteId,
    remoteIdGuid,
    AcceptInvitation: jest.fn(),
    GetUser: jest.fn(),
    SetUserLanguage: jest.fn(),
  };
});
jest.mock('../crud/syncToMemory', () => ({
  pullRemoteToMemory: jest.fn().mockResolvedValue(undefined),
}));

import MemorySource from '@orbit/memory';
import { RecordKeyMap } from '@orbit/records';
import { schema } from '../schema';
import { axiosGet } from '../utils/axios';
import { logError } from '../utils';
import { processDataChanges } from './processDataChanges';

const axiosGetMock = axiosGet as jest.Mock;

function rel(type: string, id: string) {
  return { data: { type, id } };
}

async function seed(memory: MemorySource) {
  await memory.update((t) => [
    t.addRecord({
      type: 'user',
      id: 'me',
      attributes: { name: 'Me' },
      keys: { remoteId: '1' },
    }),
    t.addRecord({
      type: 'user',
      id: 'other',
      attributes: { name: 'Other' },
      keys: { remoteId: '2' },
    }),
    t.addRecord({
      type: 'organization',
      id: 'local-org',
      attributes: { name: 'Team' },
      keys: { remoteId: '8' },
    }),
    t.addRecord({
      type: 'organization',
      id: 'local-org-2',
      attributes: { name: 'Other Team' },
      keys: { remoteId: '9' },
    }),
    t.addRecord({
      type: 'group',
      id: 'local-group',
      attributes: { name: 'All' },
      keys: { remoteId: '4' },
      relationships: { owner: rel('organization', 'local-org') },
    }),
    t.addRecord({
      type: 'group',
      id: 'local-group-2',
      attributes: { name: 'Other' },
      keys: { remoteId: '5' },
      relationships: { owner: rel('organization', 'local-org-2') },
    }),
    t.addRecord({
      type: 'project',
      id: 'local-p1',
      attributes: { name: 'P1' },
      keys: { remoteId: '10' },
      relationships: {
        organization: rel('organization', 'local-org'),
        group: rel('group', 'local-group'),
      },
    }),
    t.addRecord({
      type: 'project',
      id: 'local-p2',
      attributes: { name: 'P2' },
      keys: { remoteId: '11' },
      relationships: {
        organization: rel('organization', 'local-org-2'),
        group: rel('group', 'local-group-2'),
      },
    }),
    t.addRecord({
      type: 'offlineproject',
      id: 'op1',
      attributes: { offlineAvailable: true, snapshotDate: '2020-01-01' },
      relationships: { project: rel('project', 'local-p1') },
    }),
    t.addRecord({
      type: 'offlineproject',
      id: 'op2',
      attributes: { offlineAvailable: true, snapshotDate: '2020-01-01' },
      relationships: { project: rel('project', 'local-p2') },
    }),
    t.addRecord({
      type: 'organizationmembership',
      id: 'local-om-me',
      attributes: {},
      keys: { remoteId: '20' },
      relationships: {
        user: rel('user', 'me'),
        organization: rel('organization', 'local-org'),
      },
    }),
    t.addRecord({
      type: 'organizationmembership',
      id: 'local-om-other',
      attributes: {},
      keys: { remoteId: '21' },
      relationships: {
        user: rel('user', 'other'),
        organization: rel('organization', 'local-org'),
      },
    }),
    t.addRecord({
      type: 'groupmembership',
      id: 'local-gm-me',
      attributes: {},
      keys: { remoteId: '30' },
      relationships: {
        user: rel('user', 'me'),
        group: rel('group', 'local-group'),
      },
    }),
    t.addRecord({
      type: 'groupmembership',
      id: 'local-gm-other',
      attributes: {},
      keys: { remoteId: '31' },
      relationships: {
        user: rel('user', 'other'),
        group: rel('group', 'local-group'),
      },
    }),
  ]);
}

function offlineIds(memory: MemorySource) {
  return (
    memory.cache.query((q) => q.findRecords('offlineproject')) as {
      id: string;
    }[]
  )
    .map((op) => op.id)
    .sort();
}

async function applyDeletes(
  memory: MemorySource,
  deleted: { type: string; ids: number[] }[]
) {
  axiosGetMock.mockResolvedValue({
    data: {
      attributes: { startnext: -1, changes: [], deleted },
    },
  });
  const result = await processDataChanges({
    token: 't',
    api: '/api/datachanges',
    params: undefined,
    started: 0,
    coordinator: {
      getSource: (name: string) => {
        if (name === 'memory') return memory;
        if (name === 'backup') return { sync: async () => undefined };
        return undefined;
      },
    } as never,
    user: 'me',
    errorReporter: {},
    setLanguage: jest.fn() as never,
    setDataChangeCount: jest.fn(),
  });
  if (result !== -1) {
    const logged = (logError as jest.Mock).mock.calls
      .map((call) => String(call[2]?.message ?? call[2]))
      .join('\n');
    throw new Error(`datachanges returned ${result}: ${logged}`);
  }
  return result;
}

function memoryWithKeys() {
  return new MemorySource({ schema, keyMap: new RecordKeyMap() });
}

describe('processDataChanges offline projects', () => {
  beforeEach(() => {
    (logError as jest.Mock).mockClear();
  });

  it('removes the offline project when the project is deleted', async () => {
    const memory = memoryWithKeys();
    await seed(memory);
    const result = await applyDeletes(memory, [{ type: 'project', ids: [10] }]);
    expect(result).toBe(-1);
    expect(offlineIds(memory)).toEqual(['op2']);
  });

  it('removes the team offline projects when the team is deleted', async () => {
    const memory = memoryWithKeys();
    await seed(memory);
    await applyDeletes(memory, [{ type: 'organization', ids: [8] }]);
    expect(offlineIds(memory)).toEqual(['op2']);
  });

  it('removes offline projects when the current user membership is deleted', async () => {
    const memory = memoryWithKeys();
    await seed(memory);
    await applyDeletes(memory, [{ type: 'organizationmembership', ids: [20] }]);
    expect(offlineIds(memory)).toEqual(['op2']);
  });

  it('keeps offline projects when someone else is removed from the team', async () => {
    const memory = memoryWithKeys();
    await seed(memory);
    await applyDeletes(memory, [{ type: 'organizationmembership', ids: [21] }]);
    expect(offlineIds(memory)).toEqual(['op1', 'op2']);
  });

  it('removes offline projects when the current user group membership is deleted', async () => {
    const memory = memoryWithKeys();
    await seed(memory);
    await applyDeletes(memory, [{ type: 'groupmembership', ids: [30] }]);
    expect(offlineIds(memory)).toEqual(['op2']);
  });

  it('keeps offline projects when someone else loses a group membership', async () => {
    const memory = memoryWithKeys();
    await seed(memory);
    await applyDeletes(memory, [{ type: 'groupmembership', ids: [31] }]);
    expect(offlineIds(memory)).toEqual(['op1', 'op2']);
  });
});
