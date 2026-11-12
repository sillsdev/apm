import { useState } from 'react';
import { ReferenceTextRank } from '../../../business/referenceText/referenceText';
import { compareReferenceTextRank } from './compareReferenceTextId';

/**
 * The Reference Text chosen on Compare, shared by desktop and mobile. A
 * Reference Text is spoken, not played: choosing one remembers the choice and
 * clears the media player (TT-7819).
 */
export const useCompareReferenceText = (
  keys: { removeStoredKeys: () => void; saveKey: (id: string) => void },
  clearPlayer: () => void
) => {
  const [referenceRank, setReferenceRank] = useState<ReferenceTextRank>();

  /** True when id names a Reference Text, so it is handled here. */
  const selectReferenceText = (id: string) => {
    const rank = compareReferenceTextRank(id);
    setReferenceRank(rank);
    if (!rank) return false;
    keys.removeStoredKeys();
    keys.saveKey(id);
    clearPlayer();
    return true;
  };

  const clearReferenceText = () => setReferenceRank(undefined);

  return { referenceRank, selectReferenceText, clearReferenceText };
};
