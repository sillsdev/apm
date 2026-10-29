import { shallowEqual, useSelector } from 'react-redux';
import {
  bibleLabel,
  byRole,
  languageLabel,
  ReferenceText,
  ReferenceTextRole,
} from '../../../business/referenceText/referenceText';
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
    role: byRole(role, [t.primaryReferenceText, t.secondaryReferenceText]),
    language: languageLabel(referenceText, lang),
  };
};
