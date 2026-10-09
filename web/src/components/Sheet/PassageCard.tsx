import { ISheet, IwsKind, PassageTypeEnum } from '../../model';
import { Box, Card, Typography, useTheme } from '@mui/material';
import { passageTypeFromRef } from '../../control/passageTypeFromRef';
import { PassagePlayButton } from './PassagePlayButton';
import { PassageRef } from './PassageRef';
import { PassageCardHeader } from './PassageCardHeader';
import { PassageAssignee } from './PassageAssignee';
import { PassageStepButton } from './PassageStepButton';
import { useMobile } from '../../utils';
import { useCardHeight, useMeasureCardHeight } from '../CardSize/useCardSize';

const minPassageCardHeight = 176;

interface IProps {
  cardInfo: ISheet;
  handleViewStep: () => void;
  onPlayStatus?: () => void;
  onGraphicClick?: () => void;
  isPlaying: boolean;
  isPlayActive?: boolean;
  isPersonal?: boolean;
  isCurrent?: boolean;
}

export function PassageCard(props: IProps) {
  const { isMobileWidth } = useMobile();
  const {
    cardInfo,
    handleViewStep,
    onPlayStatus,
    onGraphicClick,
    isPlaying,
    isPlayActive,
    isPersonal,
    isCurrent,
  } = props;
  const noteTitle = cardInfo?.sharedResource?.attributes.title;
  // Unsaved rows have no passage record yet, so fall back to the row fields.
  const ref =
    noteTitle || cardInfo.passage?.attributes.reference || cardInfo.reference;

  const comment =
    cardInfo?.sharedResource?.attributes.description ||
    (noteTitle ? cardInfo.reference?.split('|')[1] : '') ||
    cardInfo.comment;

  const psgType = cardInfo.passage
    ? passageTypeFromRef(cardInfo.passage.attributes.reference, false)
    : cardInfo.passageType;

  const passageId = cardInfo.passage?.id;
  const isChapter = psgType === PassageTypeEnum.CHAPTERNUMBER;

  // Chapter cards stretch their play button to fill the card, so they'd report
  // the height they were given rather than what they need. At phone width
  // there's one card per row, so there's nothing to line up with.
  const cardHeight = useCardHeight(minPassageCardHeight);
  const contentRef = useMeasureCardHeight(
    isChapter || isMobileWidth
      ? undefined
      : (passageId ?? `${cardInfo.sectionId?.id}-${cardInfo.passageSeq}`)
  );

  const theme = useTheme();

  const mediaId = cardInfo.mediaId?.id;
  const playButton = mediaId ? (
    <PassagePlayButton
      mediaId={mediaId}
      playing={isPlaying}
      active={isPlayActive}
      onToggle={onPlayStatus}
    />
  ) : null;

  return (
    <Card
      elevation={3}
      id={passageId ? `passage-card-${passageId}` : undefined}
      data-cy={passageId ? `passage-card-${passageId}` : undefined}
      aria-current={isCurrent ? 'true' : undefined}
      sx={{
        boxSizing: 'border-box',
        minHeight: isMobileWidth ? minPassageCardHeight : cardHeight,
        display: 'flex',
        flexDirection: 'column',
        p: 1.5,
        ...(isCurrent && {
          outline: '2px solid',
          outlineColor: 'primary.light',
          outlineOffset: 2,
        }),
      }}
    >
      <Box
        ref={contentRef}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: isChapter ? 0 : 1,
          flex: 1,
        }}
      >
        {isChapter ? (
          <>
            <PassageCardHeader
              cardInfo={cardInfo}
              passageRef={ref}
              comment={comment}
              psgType={psgType}
              onGraphicClick={onGraphicClick}
            ></PassageCardHeader>
            <Box
              sx={{
                display: 'flex',
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {playButton}
            </Box>
          </>
        ) : (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <PassageCardHeader
                cardInfo={cardInfo}
                passageRef={ref}
                comment={comment}
                psgType={psgType}
                onGraphicClick={onGraphicClick}
              >
                {playButton}
              </PassageCardHeader>
              {cardInfo.kind === IwsKind.SectionPassage && (
                <PassageRef
                  psgType={psgType}
                  book={cardInfo.book}
                  passageRef={ref}
                  comment={comment}
                />
              )}
              <Typography
                variant="body2"
                color="grey"
                sx={{
                  lineHeight: theme.spacing(3.5),
                  minWidth: 0,
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  WebkitLineClamp: 1,
                  overflow: 'hidden',
                  overflowWrap: 'anywhere',
                }}
              >
                {comment}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {!isPersonal && <PassageAssignee assign={cardInfo.assign} />}
              <PassageStepButton
                step={cardInfo.step}
                onClick={handleViewStep}
              />
            </Box>
          </>
        )}
      </Box>
    </Card>
  );
}
