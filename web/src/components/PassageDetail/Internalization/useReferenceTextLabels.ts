import { shallowEqual, useSelector } from 'react-redux';
import {
  bibleLabel,
  languageLabel,
  ReferenceText,
} from '../../../business/referenceText/referenceText';
import { ReferenceTextRole } from '../../../business/referenceText/useReferenceTextPassage';
import { IState, IVProjectStrings } from '../../../model';
import { vProjectSelector } from '../../../selector';

/** The Bible, role and language names for a Reference Text, in the UI language. */
export const useReferenceTextLabels = (
  referenceText: ReferenceText,
  role: ReferenceTextRole
) => {
  const lang = useSelector((state: IState) => state.strings.lang);
  const t: IVProjectStrings = useSelector(vProjectSelector, shallowEqual);
  return {
    bible: bibleLabel(referenceText, lang),
    role:
      role === 'primary' ? t.primaryReferenceText : t.secondaryReferenceText,
    language: languageLabel(referenceText, lang),
  };
};
