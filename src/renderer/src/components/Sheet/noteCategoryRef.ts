import { PassageTypeEnum } from '../../model/passageType';
import { passageTypeFromRef } from '../../control/passageTypeFromRef';

/**
 * The category shown on a note row lives in the passage reference as
 * `NOTE|{localized category}`, but that string is only a cache: the durable
 * record of a note's category is the shared resource's artifactCategory
 * relationship. A rebuild of the sheet can therefore see a bare `NOTE` (or a
 * reference left over from an earlier category) and drop the category name,
 * image and color from the row (TT-7713).
 *
 * @param ref - the reference stored on the passage
 * @param category - localized category name from the shared resource, if any
 * @returns the reference the sheet row should use
 */
export const noteCategoryRef = (ref?: string, category?: string) => {
  if (passageTypeFromRef(ref) !== PassageTypeEnum.NOTE) return ref;
  return category ? `${PassageTypeEnum.NOTE}|${category}` : ref;
};

/**
 * Category carried by a note reference, if any. A note reference with no
 * category (a bare `NOTE`) is the corruption TT-7713 repairs; one that merely
 * names a different category is a rename or another reader's language.
 *
 * @param ref - the reference stored on the passage
 * @returns the category part, or '' when the reference has none
 */
export const noteCategoryOf = (ref?: string) =>
  passageTypeFromRef(ref) === PassageTypeEnum.NOTE
    ? (ref?.split('|')[1] ?? '')
    : '';

export default noteCategoryRef;
