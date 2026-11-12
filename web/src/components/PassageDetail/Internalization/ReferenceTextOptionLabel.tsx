import {
  ReferenceText,
  ReferenceTextRank,
} from '../../../business/referenceText/referenceText';
import { useReferenceTextLabels } from './useReferenceTextLabels';

interface IProps {
  rank: ReferenceTextRank;
  referenceText: ReferenceText;
}

/** A Reference Text in the Compare resource list: its rank, then its Bible. */
export function ReferenceTextOptionLabel({
  rank,
  referenceText,
}: Readonly<IProps>) {
  const labels = useReferenceTextLabels(referenceText, rank);
  return (
    <>
      {labels.rank} —{' '}
      <span dir={referenceText.textDirection}>{labels.bible}</span>
    </>
  );
}

export default ReferenceTextOptionLabel;
