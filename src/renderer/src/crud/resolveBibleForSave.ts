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
  if (matchingByBibleId) return matchingByBibleId;
  if (ownerOrgId === teamId && currentBible?.id) return currentBible;
  return { type: 'bible' } as BibleD;
};
