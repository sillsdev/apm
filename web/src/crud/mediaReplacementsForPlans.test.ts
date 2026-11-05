import type Memory from '@orbit/memory';
import { mediaReplacementsForPlans } from './mediaReplacementsForPlans';

const rec = (
  type: string,
  id: string,
  rels?: Record<string, { data: { type: string; id: string } }>
) => ({
  id,
  type,
  relationships: rels ?? {},
});

const link = (type: string, id: string) => ({ data: { type, id } });

const memoryWith = (byType: Record<string, ReturnType<typeof rec>[]>) => {
  const queried: string[] = [];
  const memory = {
    cache: {
      query: (cb: (q: { findRecords: (type: string) => unknown }) => unknown) =>
        cb({
          findRecords: (type: string) => {
            queried.push(type);
            return byType[type] ?? [];
          },
        }),
    },
  } as unknown as Memory;
  return { memory, queried };
};

describe('mediaReplacementsForPlans', () => {
  const rows = {
    mediareplacement: [
      rec('mediareplacement', 'mine', { passage: link('passage', 'p1') }),
      rec('mediareplacement', 'other', { passage: link('passage', 'p2') }),
      rec('mediareplacement', 'unlinked'),
    ],
    passage: [
      rec('passage', 'p1', { section: link('section', 's1') }),
      rec('passage', 'p2', { section: link('section', 's2') }),
    ],
    section: [
      rec('section', 's1', { plan: link('plan', 'plan-1') }),
      rec('section', 's2', { plan: link('plan', 'plan-2') }),
    ],
  };

  it('keeps replacements reached from the plans through sections and passages', () => {
    const { memory, queried } = memoryWith(rows);
    expect(
      mediaReplacementsForPlans(memory, ['plan-1']).map((r) => r.id)
    ).toEqual(['mine']);
    expect(queried).toEqual(['section', 'passage', 'mediareplacement']);
  });

  it('returns every replacement when no plans are given', () => {
    const { memory, queried } = memoryWith(rows);
    expect(mediaReplacementsForPlans(memory).map((r) => r.id)).toEqual([
      'mine',
      'other',
      'unlinked',
    ]);
    expect(queried).toEqual(['mediareplacement']);
  });
});
