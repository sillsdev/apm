import { shallowEqual, useSelector } from 'react-redux';
import { lwcTranslationSelector } from '../../../selector';
import { ILwcTranslationStrings } from '@model/index';
import BoldClauseNav from '../boldClause/BoldClauseNav';

interface Props {
  currentIndex: number;
  totalClauses: number;
  completedCount: number;
  currentClauseRecorded: boolean;
  navigationDisabled: boolean;
  onPrev: () => void;
  onNext: () => void;
}

export default function LwcTranslationClauseNav(props: Props) {
  const t: ILwcTranslationStrings = useSelector(
    lwcTranslationSelector,
    shallowEqual
  );

  return (
    <BoldClauseNav
      {...props}
      currentClauseComplete={props.currentClauseRecorded}
      strings={{ clauseIndex: t.clauseIndex, progress: t.progress }}
      dataCy="lwc-clause-nav"
      prevId="lwc-clause-prev"
      nextId="lwc-clause-next"
    />
  );
}
