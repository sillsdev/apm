import { PassageD } from '../../model';

/**
 * Returns the passage with its reference updated. When the reference text
 * actually changes, the cached startChapter/endChapter/startVerse/endVerse
 * (calculated in the online db, or by a previous parseRef) are reset to
 * undefined so parseRef/resolveSheetStartChapter recompute them from the new
 * reference instead of trusting stale values (TT-7704 follow-up: Update
 * Publishing Rows was skipping CHNUM rows because an edited reference's
 * chapter never got invalidated).
 */
export function withUpdatedReference(
  passage: PassageD | undefined,
  newReference: string
): PassageD | undefined {
  if (!passage) return passage;
  if (passage.attributes?.reference === newReference) return passage;
  return {
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
}
