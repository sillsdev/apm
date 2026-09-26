/**
 * TT-6952 — useProjectDelete leaves records behind on the server.
 *
 * `if (!plans.length) return;` bails out before the project itself is removed,
 * and only `plans[0]` is handled, so a project with two plans keeps the second
 * one. Both leave rows the user believes they deleted, which is what the next
 * data-changes poll and sanity check then trip over.
 */
const mockRelated = jest.fn();
const mockOfflineDelete = jest.fn();

jest.mock('.', () => ({
  related: (...args: unknown[]) => mockRelated(...args),
}));
jest.mock('./useOfflnProjDelete', () => ({
  useOfflnProjDelete: () => mockOfflineDelete,
}));
jest.mock('../context/useGlobal', () => ({
  useGlobal: jest.fn(),
  useGetGlobal: jest.fn(),
}));

import { renderHook, act } from '@testing-library/react';
import { useGlobal, useGetGlobal } from '../context/useGlobal';
import { useProjectDelete } from './useProjectDelete';

const PROJECT = 'proj1';

const plan = (id: string) => ({
  type: 'plan',
  id,
  relationships: { project: { data: { id: PROJECT } } },
});

const setup = (plans: ReturnType<typeof plan>[]) => {
  const tables: Record<string, unknown[]> = {
    plan: plans,
    mediafile: [],
    discussion: [],
    comment: [],
    section: [],
    passage: [],
    passagestatechange: [],
    sectionresource: [],
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

  const update = jest.fn(async () => undefined);
  const memory = { cache: { query: cacheQuery }, update };

  mockOfflineDelete.mockResolvedValue(undefined);
  mockRelated.mockImplementation(
    (r: { relationships?: Record<string, { data?: { id: string } }> }, k) =>
      r?.relationships?.[k as string]?.data?.id
  );

  (useGlobal as jest.Mock).mockImplementation((key: string) => {
    const values: Record<string, unknown> = {
      memory,
      offlineOnly: false,
      projectsLoaded: [PROJECT],
    };
    return [values[key], jest.fn()];
  });
  (useGetGlobal as jest.Mock).mockReturnValue(() => [PROJECT]);

  type RemoveOp = { record: { type: string; id: string } };
  /** Every record identity this hook asked the server to remove. */
  const removed = (): { type: string; id: string }[] =>
    (update.mock.calls as unknown as Array<[RemoveOp[]]>).flatMap(([ops]) =>
      (ops ?? []).map((o) => o.record)
    );

  return { removed };
};

describe('useProjectDelete', () => {
  it('removes the project even when it has no plan', async () => {
    const { removed } = setup([]);
    const { result } = renderHook(() => useProjectDelete());

    await act(async () => {
      await result.current(PROJECT);
    });

    expect(removed()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'project', id: PROJECT }),
      ])
    );
  });

  it('removes every plan of the project, not just the first', async () => {
    const { removed } = setup([plan('plan1'), plan('plan2')]);
    const { result } = renderHook(() => useProjectDelete());

    await act(async () => {
      await result.current(PROJECT);
    });

    const planIds = removed()
      .filter((r) => r.type === 'plan')
      .map((r) => r.id);
    expect(planIds).toEqual(expect.arrayContaining(['plan1', 'plan2']));
  });

  it('removes the plan and the project in the ordinary single-plan case', async () => {
    const { removed } = setup([plan('plan1')]);
    const { result } = renderHook(() => useProjectDelete());

    await act(async () => {
      await result.current(PROJECT);
    });

    expect(removed().map((r) => `${r.type}:${r.id}`)).toEqual([
      'plan:plan1',
      `project:${PROJECT}`,
    ]);
  });
});
