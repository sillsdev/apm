import type Memory from '@orbit/memory';
import { mediaReplacementsForPlans } from './mediaReplacementsForPlans';

const replacement = (id: string, planId?: string) => ({
  id,
  type: 'mediareplacement' as const,
  relationships: planId ? { plan: { data: { type: 'plan', id: planId } } } : {},
});

const memoryWith = (rows: ReturnType<typeof replacement>[]) =>
  ({
    cache: {
      query: (cb: (q: { findRecords: () => unknown }) => unknown) =>
        cb({ findRecords: () => rows }),
    },
  }) as unknown as Memory;

describe('mediaReplacementsForPlans', () => {
  const rows = [
    replacement('mine', 'plan-1'),
    replacement('other', 'plan-2'),
    replacement('unplanned'),
  ];

  it('keeps replacements whose plan is in the list', () => {
    expect(
      mediaReplacementsForPlans(memoryWith(rows), ['plan-1']).map((r) => r.id)
    ).toEqual(['mine']);
  });

  it('returns every replacement when no plans are given', () => {
    expect(
      mediaReplacementsForPlans(memoryWith(rows)).map((r) => r.id)
    ).toEqual(['mine', 'other', 'unplanned']);
  });
});
