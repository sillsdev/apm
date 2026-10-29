import type Memory from '@orbit/memory';
import { MediaReplacementD } from '../model/mediareplacement';
import { related } from './related';

/** Replacements in memory. With `planIds`, only those whose plan is in the list. */
export const mediaReplacementsForPlans = (
  memory: Memory | undefined,
  planIds?: Iterable<string>
): MediaReplacementD[] => {
  const recs =
    (memory?.cache.query((q) =>
      q.findRecords('mediareplacement')
    ) as MediaReplacementD[]) ?? [];
  if (!planIds) return recs;
  const ids = new Set(planIds);
  return recs.filter((r) => ids.has(related(r, 'plan')));
};
