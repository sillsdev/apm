import { shallowEqual, useSelector } from 'react-redux';
import {
  bibleLabel,
  byRank,
  languageLabel,
  ReferenceText,
  ReferenceTextRank,
} from '../../../business/referenceText/referenceText';
import { IState, IVProjectStrings } from '../../../model';
import { vProjectSelector } from '../../../selector';

/** The Bible, rank and language names for a Reference Text, in the UI language. */
export const useReferenceTextLabels = (
  referenceText: ReferenceText,
  rank: ReferenceTextRank
) => {
  const lang = useSelector((state: IState) => state.strings.lang);
  const t: IVProjectStrings = useSelector(vProjectSelector, shallowEqual);
  return {
    bible: bibleLabel(referenceText, lang),
    rank: byRank(rank, [t.primaryReferenceText, t.secondaryReferenceText]),
    language: languageLabel(referenceText, lang),
  };
};
