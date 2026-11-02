import {
  ReferenceTextRank,
  referenceTextRanks,
} from '../../../business/referenceText/referenceText';

/** The Compare resource id of a Reference Text, kept apart from mediafile ids. */
export const compareReferenceTextId = (rank: ReferenceTextRank) =>
  `referenceText:${rank}`;

/** The rank a Compare resource id names; undefined for a mediafile id. */
export const compareReferenceTextRank = (
  id: string
): ReferenceTextRank | undefined =>
  referenceTextRanks.find((rank) => compareReferenceTextId(rank) === id);
