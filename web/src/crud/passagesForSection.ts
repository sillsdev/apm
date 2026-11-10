import Memory from '@orbit/memory';
import { PassageD } from '../model';
import { related } from './related';
import { findRecords } from './tryFindRecord';

/** Passages belonging to a section (works offline when section.relationships.passages is empty). */
export function passagesForSection(
  memory: Memory | undefined,
  sectionId: string | undefined
): PassageD[] {
  if (!memory || !sectionId) return [];
  return findRecords(memory, 'passage').filter(
    (p) => related(p, 'section') === sectionId
  );
}
