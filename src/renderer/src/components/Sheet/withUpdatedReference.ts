import { PassageD } from '../../model';
import { parseRef } from '../../crud/passage';

/**
 * Returns the passage with its reference updated. When the reference text
 * actually changes, the cached startChapter/endChapter/startVerse/endVerse
 * (calculated in the online db, or by a previous parseRef) are cleared and
 * parseRef is run immediately (TT-7704 follow-up, PR #675 review) rather than
 * left undefined: JSONAPIResourceSerializer skips any attribute whose value
 * is `undefined` when building the outgoing PATCH, so an undefined value
 * never overwrites the stale number already stored in the online db — a
 * later refetch would bring the stale chapter right back. Computing the real
 * value here means the persisted record is correct immediately.
 */
export function withUpdatedReference(
  passage: PassageD | undefined,
  newReference: string
): PassageD | undefined {
  if (!passage) return passage;
  if (passage.attributes?.reference === newReference) return passage;
  const updated: PassageD = {
    ...passage,
    attributes: {
      ...passage.attributes,
      reference: newReference,
      startChapter: undefined,
      endChapter: undefined,
      startVerse: undefined,
      endVerse: undefined,
    },
  };
  parseRef(updated);
  return updated;
}
