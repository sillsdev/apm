import {
  ReferenceTextPassage,
  ReferenceTextRank,
} from '../../../business/referenceText/useReferenceTextPassage';

/** A Reference Text the project has, in any state but `none`. */
export type ShownReferenceTextPassage = Exclude<
  ReferenceTextPassage,
  { status: 'none' }
>;

/** Props shared by the desktop row and the mobile card. */
export interface ReferenceTextItemProps {
  rank: ReferenceTextRank;
  passage: ShownReferenceTextPassage;
  /** Whether this Reference Text is being spoken. */
  speaking: boolean;
  /** Percent spoken, 0–100. */
  progress: number;
  onPlay: (rank: ReferenceTextRank) => void;
  onView: (rank: ReferenceTextRank) => void;
}
