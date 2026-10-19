import { useContext } from 'react';
import { useSelector, shallowEqual } from 'react-redux';
import { PassageTypeEnum, IPlanSheetStrings, IState } from '../../model';
import { passageTypeFromRef } from '../../control/passageTypeFromRef';
import { PlanContext } from '../../context/PlanContext';
import { planSheetSelector } from '../../selector';

interface PassageRefTextArgs {
  psgType: PassageTypeEnum;
  book?: string;
  passageRef?: string;
  comment?: string;
}

export const usePassageRefText = () => {
  const ctx = useContext(PlanContext);
  const t: IPlanSheetStrings = useSelector(planSheetSelector, shallowEqual);
  const bookMap = useSelector((state: IState) => state.books.map);

  const getBookName = (bookAbbreviation: string | undefined): string => {
    // For general projects (non-scripture), return empty string
    if (!ctx.state.scripture) {
      return '';
    }
    return bookAbbreviation && bookMap
      ? bookMap[bookAbbreviation]
      : bookAbbreviation || t.unknownBook;
  };

  return ({ psgType, book, passageRef, comment }: PassageRefTextArgs) => {
    if (psgType === PassageTypeEnum.PASSAGE) {
      return `${getBookName(book)} ${passageRef}`;
    }

    if (!passageRef) {
      return '';
    }

    if (psgType === PassageTypeEnum.CHAPTERNUMBER && comment) {
      return comment;
    }

    // Strip the type prefix (e.g. "CHNUM 1" -> "1")
    const refType = passageTypeFromRef(passageRef);
    return refType === PassageTypeEnum.PASSAGE
      ? passageRef
      : passageRef.substring(refType.length + 1);
  };
};
