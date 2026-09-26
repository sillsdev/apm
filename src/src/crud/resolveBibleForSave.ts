import { BibleD } from '../model';

/** Which bible record to persist: an existing match, the owned current bible, or a new one. */
export const resolveBibleForSave = (
  bibleId: string,
  matchingByBibleId: BibleD | undefined,
  currentBible: BibleD | undefined,
  ownerOrgId: string | undefined,
  teamId: string
): BibleD | undefined => {
  if (!bibleId) return undefined;
  const ownsCurrent = ownerOrgId === teamId;
  if (matchingByBibleId) {
    // Don't UpdateRecord a shared bible the user couldn't edit.
    if (!ownsCurrent && matchingByBibleId.id === currentBible?.id)
      return undefined;
    return matchingByBibleId;
  }
  if (ownsCurrent && currentBible?.id) return currentBible;
  return { type: 'bible' } as BibleD;
};
