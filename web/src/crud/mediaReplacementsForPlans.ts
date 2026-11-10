import type Memory from '@orbit/memory';

import { MediaReplacementD } from '../model/mediareplacement';
import { related } from './related';
import { findRecords } from './tryFindRecord';

/** Replacements in memory. With `planIds`, sections of those plans, then their passages, then replacements. */
export const mediaReplacementsForPlans = (
  memory: Memory | undefined,
  planIds?: Iterable<string>
): MediaReplacementD[] => {
  const replacements = () => findRecords(memory, 'mediareplacement') ?? [];
  if (!planIds) return replacements();
  const ids = new Set(planIds);
  const sectionIds = new Set(
    (findRecords(memory, 'section') ?? [])
      .filter((s) => ids.has(related(s, 'plan')))
      .map((s) => s.id)
  );
  const passageIds = new Set(
    (findRecords(memory, 'passage') ?? [])
      .filter((p) => sectionIds.has(related(p, 'section')))
      .map((p) => p.id)
  );
  return replacements().filter((r) => passageIds.has(related(r, 'passage')));
};
