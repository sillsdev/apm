import {
  ReferenceTextRank,
  useProjectReferenceTexts,
  useReferenceTextPassage,
} from '../../../business/referenceText/useReferenceTextPassage';
import { byRank } from '../../../business/referenceText/referenceText';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { ShownReferenceTextPassage } from './referenceTextItem';

/**
 * The current passage read from the project's Primary and Secondary Reference
 * Texts: both ranks' passages, and the ones the project has (ADR 0014).
 */
export const useShownReferenceTexts = () => {
  const { passage } = usePassageDetailContext();
  const referenceTexts = useProjectReferenceTexts();
  const primary = useReferenceTextPassage(
    passage,
    byRank('primary', referenceTexts)
  );
  const secondary = useReferenceTextPassage(
    passage,
    byRank('secondary', referenceTexts)
  );

  const shown = (
    [
      ['primary', primary],
      ['secondary', secondary],
    ] as const
  ).filter(
    (entry): entry is [ReferenceTextRank, ShownReferenceTextPassage] =>
      entry[1].status !== 'none'
  );

  return { passage, passages: [primary, secondary], shown };
};
