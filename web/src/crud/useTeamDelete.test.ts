/**
 * useTeamDelete removes the caller's memberships BEFORE deleting the team's
 * projects, and that order is deliberate: dropping the membership makes the
 * team disappear from the UI at once, so it cannot be modified while the
 * one-project-at-a-time deletes that follow are still running. Deleting the
 * projects first has caused problems before.
 *
 * TT-6952 briefly reordered this on a theory that the API rejects the later
 * DELETEs once the caller is no longer a member. Nothing was ever observed
 * rejecting them and no API code implies it, so the reorder was reverted
 * (PR #651 review). This spec pins the order so it is not "tidied" again.
 *
 * The ticket's actual symptom -- a failed delete retried forever and blocking
 * every later request -- is fixed in utils/orbitStrategyErrors.ts, which now
 * bounds the retries and skip()s the task instead of leaving it at the head of
 * JSONAPISource's shared requestQueue.
 */
const mockRelated = jest.fn();
const mockFindRecord = jest.fn();
const mockProjectDelete = jest.fn();

jest.mock('.', () => ({
  related: (...args: unknown[]) => mockRelated(...args),
  findRecord: (...args: unknown[]) => mockFindRecord(...args),
}));
jest.mock('./useProjectDelete', () => ({
  useProjectDelete: () => mockProjectDelete,
}));
jest.mock('../context/useGlobal', () => ({
  useGlobal: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react';
import { useGlobal } from '../context/useGlobal';
import { useTeamDelete } from './useTeamDelete';

type LogEntry =
  | { kind: 'update'; types: string[] }
  | { kind: 'sync'; types: string[] }
  | { kind: 'backupSync'; types: string[] }
  | { kind: 'projectDelete'; id: string };

const TEAM = 'org1';

const rec = (type: string, id: string, rels: Record<string, string> = {}) => ({
  type,
  id,
  relationships: Object.fromEntries(
    Object.entries(rels).map(([k, v]) => [k, { data: { id: v } }])
  ),
});

const opTypes = (ops: { record: { type: string } }[]) =>
  ops.map((o) => o.record.type);

const setup = () => {
  const log: LogEntry[] = [];

  const tables: Record<string, unknown[]> = {
    group: [rec('group', 'g1', { owner: TEAM })],
    groupmembership: [rec('groupmembership', 'gm1', { group: 'g1' })],
    project: [rec('project', 'proj1', { group: 'g1' })],
    organizationmembership: [
      rec('organizationmembership', 'om1', { organization: TEAM }),
    ],
    artifactcategory: [],
    orgworkflowstep: [],
    artifacttype: [],
    discussion: [],
    comment: [],
  };

  const cacheQuery = jest.fn((cb: (q: unknown) => unknown) => {
    let requested = '';
    const chain = { filter: () => chain };
    cb({
      findRecords: (t: string) => {
        requested = t;
        return chain;
      },
    });
    return tables[requested] ?? [];
  });

  const memory = {
    cache: { query: cacheQuery },
    update: jest.fn(async (ops: { record: { type: string } }[]) => {
      log.push({ kind: 'update', types: opTypes(ops) });
    }),
    sync: jest.fn(async (fn: () => { record: { type: string } }[]) => {
      log.push({ kind: 'sync', types: opTypes(fn()) });
    }),
  };
  const backup = {
    sync: jest.fn(async (fn: () => { record: { type: string } }[]) => {
      log.push({ kind: 'backupSync', types: opTypes(fn()) });
    }),
  };
  const coordinator = { getSource: jest.fn(() => backup) };

  mockProjectDelete.mockImplementation(async (id: string) => {
    log.push({ kind: 'projectDelete', id });
  });
  mockFindRecord.mockReturnValue(rec('organization', TEAM));
  mockRelated.mockImplementation(
    (r: { relationships?: Record<string, { data?: { id: string } }> }, k) =>
      r?.relationships?.[k as string]?.data?.id
  );

  (useGlobal as jest.Mock).mockImplementation((key: string) => {
    const values: Record<string, unknown> = {
      memory,
      coordinator,
      offlineOnly: false,
    };
    return [values[key], jest.fn()];
  });

  return { log, memory };
};

/** Indexes into the ordered log of everything the hook did. */
const serverMembershipIndex = (log: LogEntry[]) =>
  log.findIndex(
    (e) =>
      e.kind === 'update' &&
      e.types.some((t) =>
        ['organizationmembership', 'groupmembership'].includes(t)
      )
  );

const firstProjectDeleteIndex = (log: LogEntry[]) =>
  log.findIndex((e) => e.kind === 'projectDelete');

describe('useTeamDelete', () => {
  it("revokes the caller's memberships before deleting the team's projects", async () => {
    const { log } = setup();
    const { result } = renderHook(() => useTeamDelete());

    await act(async () => {
      await result.current(TEAM);
    });

    expect(serverMembershipIndex(log)).toBeGreaterThanOrEqual(0);
    expect(firstProjectDeleteIndex(log)).toBeGreaterThan(
      serverMembershipIndex(log)
    );
  });

  it('still removes every membership, group and the org itself', async () => {
    const { log } = setup();
    const { result } = renderHook(() => useTeamDelete());

    await act(async () => {
      await result.current(TEAM);
    });

    const allTypes = log.flatMap((e) =>
      e.kind === 'projectDelete' ? [] : e.types
    );
    expect(allTypes).toEqual(
      expect.arrayContaining([
        'organizationmembership',
        'groupmembership',
        'group',
        'organization',
      ])
    );
    expect(log.filter((e) => e.kind === 'projectDelete')).toHaveLength(1);
  });

  it('does nothing when the team is already gone', async () => {
    const { log } = setup();
    mockFindRecord.mockReturnValue(undefined);
    const { result } = renderHook(() => useTeamDelete());

    await act(async () => {
      await result.current(TEAM);
    });

    expect(log).toHaveLength(0);
  });
});
