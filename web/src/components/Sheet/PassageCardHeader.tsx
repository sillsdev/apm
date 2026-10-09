import { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import { ISheet, IwsKind, PassageTypeEnum } from '../../model';
import { PassageGraphic } from './PassageGraphic';
import { PassageRef } from './PassageRef';
import { useSectionIdDescription } from './useSectionIdDescription';

interface IProps {
  cardInfo: ISheet;
  passageRef?: string;
  comment?: string;
  psgType: PassageTypeEnum;
  onGraphicClick?: () => void;
  children?: ReactNode;
}

export function PassageCardHeader({
  cardInfo,
  passageRef,
  comment,
  psgType,
  onGraphicClick,
  children,
}: IProps) {
  const getDescription = useSectionIdDescription();

  return (
    <Box
      sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 51 }}
    >
      <PassageGraphic
        cardInfo={cardInfo}
        reference={passageRef}
        psgType={psgType}
        onClick={onGraphicClick}
      />
      {cardInfo.kind === IwsKind.Passage ? (
        <PassageRef
          psgType={psgType}
          book={cardInfo.book}
          passageRef={passageRef}
          comment={comment}
        />
      ) : (
        <Typography variant="h6">{getDescription(cardInfo)}</Typography>
      )}
      {children}
    </Box>
  );
}
