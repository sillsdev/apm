import { Box } from '@mui/material';
import { ISheet, IwsKind, PassageTypeEnum } from '../../model';
import { PassageGraphic } from './PassageGraphic';
import { PassagePlayButton } from './PassagePlayButton';
import { PassageCardTitle } from './PassageCardTitle';
import { usePassageRefText } from './usePassageRefText';
import { useSectionIdDescription } from './useSectionIdDescription';

interface IProps {
  cardInfo: ISheet;
  passageRef?: string;
  description?: string;
  psgType: PassageTypeEnum;
  onGraphicClick?: () => void;
  mediaId?: string;
}

export function PassageCardHeader({
  cardInfo,
  passageRef,
  description,
  psgType,
  onGraphicClick,
  mediaId,
}: IProps) {
  const getDescription = useSectionIdDescription();
  const getRefText = usePassageRefText();
  const refText = getRefText({
    psgType,
    book: cardInfo.book,
    passageRef,
    description,
  });
  const title =
    cardInfo.kind === IwsKind.Passage ? refText : getDescription(cardInfo);
  // Section passages show the section heading beside the graphic and the
  // passage reference on its own line beneath.
  const sectionPassageTitle =
    cardInfo.kind === IwsKind.SectionPassage ? refText : '';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
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
        {mediaId && <PassagePlayButton mediaId={mediaId} />}
      </Box>
      {sectionPassageTitle && (
        <PassageCardTitle>{sectionPassageTitle}</PassageCardTitle>
      )}
    </Box>
  );
}
