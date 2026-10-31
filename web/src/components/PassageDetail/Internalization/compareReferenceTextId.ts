import { ReferenceTextRank } from '../../../business/referenceText/referenceText';

const ranks: readonly ReferenceTextRank[] = ['primary', 'secondary'];

/** The Compare resource id of a Reference Text, kept apart from mediafile ids. */
export const compareReferenceTextId = (rank: ReferenceTextRank) =>
  `referenceText:${rank}`;

/** The rank a Compare resource id names; undefined for a mediafile id. */
export const compareReferenceTextRank = (
  id: string
): ReferenceTextRank | undefined =>
  ranks.find((rank) => compareReferenceTextId(rank) === id);
