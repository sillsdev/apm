import { Box, Typography } from '@mui/material';
import { ISheet, IwsKind, PassageTypeEnum } from '../../model';
import { PassageGraphic } from './PassageGraphic';
import { PassagePlayButton } from './PassagePlayButton';
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
  const getSectionLabel = useSectionIdDescription();
  const getRefText = usePassageRefText();

  const refText = getRefText({
    psgType,
    book: cardInfo.book,
    passageRef,
    description,
  });

  const title =
    cardInfo.kind === IwsKind.Passage ? refText : getSectionLabel(cardInfo);
  const subtitle = cardInfo.kind === IwsKind.SectionPassage ? refText : '';

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
        {title && (
          <Typography
            variant="h6"
            sx={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
              minWidth: 0,
              lineHeight: (theme) => theme.spacing(3.5),
              overflowWrap: 'anywhere',
            }}
          >
            {title}
          </Typography>
        )}
        {mediaId && <PassagePlayButton mediaId={mediaId} />}
      </Box>
      {subtitle && (
        <Typography
          variant="h6"
          sx={{
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            minWidth: 0,
            lineHeight: (theme) => theme.spacing(3.5),
            overflowWrap: 'anywhere',
          }}
        >
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}
