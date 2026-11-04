import type Memory from '@orbit/memory';
import { PassageD } from '../model/passage';
import { SectionD } from '../model/section';
import { MediaReplacementD } from '../model/mediareplacement';
import { related } from './related';

/** Replacements in memory. With `planIds`, sections of those plans, then their passages, then replacements. */
export const mediaReplacementsForPlans = (
  memory: Memory | undefined,
  planIds?: Iterable<string>
): MediaReplacementD[] => {
  const replacements = () =>
    (memory?.cache.query((q) =>
      q.findRecords('mediareplacement')
    ) as MediaReplacementD[]) ?? [];
  if (!planIds) return replacements();
  const ids = new Set(planIds);
  const sectionIds = new Set(
    ((memory?.cache.query((q) => q.findRecords('section')) as SectionD[]) ?? [])
      .filter((s) => ids.has(related(s, 'plan')))
      .map((s) => s.id)
  );
  const passageIds = new Set(
    ((memory?.cache.query((q) => q.findRecords('passage')) as PassageD[]) ?? [])
      .filter((p) => sectionIds.has(related(p, 'section')))
      .map((p) => p.id)
  );
  return replacements().filter((r) => passageIds.has(related(r, 'passage')));
};
