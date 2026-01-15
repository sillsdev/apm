import { Avatar } from '@mui/material';
import { useEffect, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { IPassageTypeStrings, ISheet, PassageTypeEnum } from '../../model';
import { stringAvatar } from '../../utils';
import { passageTypeSelector } from '../../selector';

interface PassageGraphicProps {
  cardInfo: ISheet;
  reference?: string;
  psgType: PassageTypeEnum;
}

export function PassageGraphic({
  cardInfo,
  reference,
  psgType,
}: PassageGraphicProps) {
  const [hasGraphicError, setHasGraphicError] = useState(false);
  const t: IPassageTypeStrings = useSelector(passageTypeSelector, shallowEqual);

  useEffect(() => {
    setHasGraphicError(false);
  }, [cardInfo.graphicUri]);

  if (
    psgType !== PassageTypeEnum.NOTE &&
    psgType !== PassageTypeEnum.CHAPTERNUMBER
  ) {
    return null;
  }

  const borderColor = cardInfo?.color;
  const border = borderColor ? { border: '2px solid', borderColor } : {};
  const pointer = { cursor: 'pointer' };
  const fallbackName = reference || cardInfo.reference || t.NOTE;

  if (cardInfo.graphicUri && !hasGraphicError) {
    return (
      <Avatar
        sx={{ ...pointer, ...border, mr: 1 }}
        src={cardInfo.graphicUri}
        slotProps={{ img: { onError: () => setHasGraphicError(true) } }}
        variant="rounded"
      />
    );
  }

  return (
    <Avatar
      {...stringAvatar(fallbackName, {
        // ...pointer,  # Disable until we add ability to edit graphics here.
        ...border,
        mr: 1,
      })}
      variant="rounded"
    />
  );
}
