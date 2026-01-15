import { Typography } from '@mui/material';
import { PassageTypeEnum, IPlanSheetStrings, IState } from '../../model';
import { RefRender } from '../../control/RefRender';
import { useContext } from 'react';
import { PlanContext } from '../../context/PlanContext';
import { useSelector, shallowEqual } from 'react-redux';
import { planSheetSelector } from '../../selector';

interface PassageRefProps {
  psgType: PassageTypeEnum;
  book?: string;
  ref?: string;
  comment?: string;
}

export function PassageRef({ psgType, book, ref, comment }: PassageRefProps) {
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

  const fullBookName = getBookName(book);

  return (
    <Typography variant="h6">
      {psgType === PassageTypeEnum.PASSAGE ? (
        `${fullBookName} ${ref}`
      ) : ref ? (
        <>
          <RefRender value={ref} pt={psgType} fontSize={'0.8rem'} />
          {psgType === PassageTypeEnum.CHAPTERNUMBER && comment
            ? ` ${comment}`
            : null}
        </>
      ) : null}
    </Typography>
  );
}
