import Memory from '@orbit/memory';
import { PassageD } from '../model';
import { related } from './related';

/** Passages belonging to a section (works offline when section.relationships.passages is empty). */
export function passagesForSection(
  memory: Memory | undefined,
  sectionId: string | undefined
): PassageD[] {
  if (!memory || !sectionId) return [];
  return (
    memory.cache.query((q) => q.findRecords('passage')) as PassageD[]
  ).filter((p) => related(p, 'section') === sectionId);
}
