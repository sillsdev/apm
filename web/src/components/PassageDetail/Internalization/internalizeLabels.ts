import { Section, Passage, BookName } from '../../../model';
import { passageRefText } from '../../../crud/passage';

/**
 * Shared row-label helpers for the Internalize "add resource" flow, so the
 * section-select checkbox list ([[buildSelectSectionRows]]) and the configure
 * dialog that follows label rows identically.
 *
 * These build only the *displayed* label. The configure dialog still stores its
 * own (unchanged) reference string for the saved resource topic — see
 * useFullReference / useProjectResourceSave — so changing these does not change
 * what is written to the database.
 */

/** Section label: its name, else "<organizedBy> <sequencenum>" (e.g. "Section 3"). */
export function sectionLabel(section: Section, organizedBy: string): string {
  return (
    section?.attributes?.name ||
    `${organizedBy} ${section?.attributes?.sequencenum}`
  );
}

/** Passage label: book + reference (e.g. "Genesis 1:1-3"). */
export function passageLabel(
  passage: Passage,
  bookData: BookName[] = []
): string {
  return passageRefText(passage, bookData);
}
