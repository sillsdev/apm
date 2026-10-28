import { Box, Stack, Typography } from '@mui/material';
import { ISheet, IwsKind, PassageTypeEnum } from '../../model';
import { PassageGraphic } from './PassageGraphic';
import { PassagePlayButton } from './PassagePlayButton';
import { usePassageRefText } from './usePassageRefText';
import { useSectionIdDescription } from './useSectionIdDescription';
import { useTitleSlack } from './useTitleSlack';

const titleLines = 2;

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

  const { titleRef, titleSlack } = useTitleSlack(
    title,
    Boolean(mediaId && title)
  );

  return (
    <Stack gap={0.5}>
      <Stack direction="row" alignItems="center" gap={1.5} minHeight={48}>
        <PassageGraphic
          cardInfo={cardInfo}
          reference={passageRef}
          psgType={psgType}
          onClick={onGraphicClick}
        />
        {title && (
          <Typography
            ref={titleRef}
            title={title}
            sx={{
              fontSize: '18px',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: titleLines,
              overflow: 'hidden',
              minWidth: 0,
              lineHeight: (theme) => theme.spacing(3),
              overflowWrap: 'anywhere',
            }}
          >
            {title}
          </Typography>
        )}
        {mediaId && (
          <Box
            sx={{ position: 'relative', display: 'flex', flexShrink: 0 }}
            style={{ insetInlineStart: title ? -titleSlack : 0 }}
          >
            <PassagePlayButton mediaId={mediaId} />
          </Box>
        )}
      </Stack>
      {subtitle && (
        <Typography noWrap variant="body1">
          {subtitle}
        </Typography>
      )}
    </Stack>
  );
}
