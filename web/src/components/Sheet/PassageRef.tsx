import { Typography, useTheme } from '@mui/material';
import { PassageTypeEnum, IPlanSheetStrings, IState } from '../../model';
import { passageTypeFromRef } from '../../control/passageTypeFromRef';
import { passageTypeMap } from '../../control/RefRender';
import { useContext } from 'react';
import { PlanContext } from '../../context/PlanContext';
import { useSelector, shallowEqual } from 'react-redux';
import { planSheetSelector } from '../../selector';

interface PassageRefProps {
  psgType: PassageTypeEnum;
  book?: string;
  passageRef?: string;
  comment?: string;
}

export function PassageRef({
  psgType,
  book,
  passageRef,
  comment,
}: PassageRefProps) {
  const theme = useTheme();
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

  if (psgType === PassageTypeEnum.PASSAGE) {
    return (
      <Typography variant="h6">{`${fullBookName} ${passageRef}`}</Typography>
    );
  }

  if (!passageRef) {
    return null;
  }

  // Strip the type prefix (e.g. "CHNUM 1" -> "1")
  const refType = passageTypeFromRef(passageRef);
  const refText =
    refType === PassageTypeEnum.PASSAGE
      ? passageRef
      : passageRef.substring(refType.length + 1);
  const showComment = psgType === PassageTypeEnum.CHAPTERNUMBER && comment;

  return (
    <Typography
      variant="h6"
      sx={{
        lineHeight: theme.spacing(3.5),
        minWidth: 0,
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: 2,
        overflow: 'hidden',
        overflowWrap: 'anywhere',
      }}
    >
      {showComment ? (
        comment
      ) : (
        <>
          {passageTypeMap[psgType]}
          {' '}
          {refText}
        </>
      )}
    </Typography>
  );
}
