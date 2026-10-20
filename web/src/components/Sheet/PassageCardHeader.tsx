import { ReactNode } from 'react';
import { Box } from '@mui/material';
import { ISheet, IwsKind, PassageTypeEnum } from '../../model';
import { PassageGraphic } from './PassageGraphic';
import { PassageCardTitle } from './PassageCardTitle';
import { usePassageRefText } from './usePassageRefText';
import { useSectionIdDescription } from './useSectionIdDescription';

interface IProps {
  cardInfo: ISheet;
  passageRef?: string;
  description?: string;
  psgType: PassageTypeEnum;
  onGraphicClick?: () => void;
  children?: ReactNode;
}

export function PassageCardHeader({
  cardInfo,
  passageRef,
  description,
  psgType,
  onGraphicClick,
  children,
}: IProps) {
  const getDescription = useSectionIdDescription();
  const getRefText = usePassageRefText();
  const title =
    cardInfo.kind === IwsKind.Passage
      ? getRefText({ psgType, book: cardInfo.book, passageRef, description })
      : getDescription(cardInfo);

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 56 }}
    >
      <PassageGraphic
        cardInfo={cardInfo}
        reference={passageRef}
        psgType={psgType}
        onClick={onGraphicClick}
      />
      {title && <PassageCardTitle>{title}</PassageCardTitle>}
      {children}
    </Box>
  );
}
