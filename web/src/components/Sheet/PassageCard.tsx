import { ISheet, IwsKind, PassageTypeEnum } from '../../model';
import { Box, Card, Typography } from '@mui/material';
import { passageTypeFromRef } from '../../control/passageTypeFromRef';
import { PlayButton } from '../PlayButton';
import { PassageRef } from './PassageRef';
import { PassageCardHeader } from './PassageCardHeader';
import { PassageAssignee } from './PassageAssignee';
import { PassageStepButton } from './PassageStepButton';
import { useMobile } from '../../utils';
import { useCardHeight, useMeasureCardHeight } from '../CardSize/useCardSize';

const minPassageCardHeight = 200;

interface IProps {
  cardInfo: ISheet;
  handleViewStep: () => void;
  onPlayStatus?: () => void;
  onGraphicClick?: () => void;
  isPlaying: boolean;
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

  const handlePlayEnd = () => {
    if (isPlaying) {
      onPlayStatus?.();
    }
  };

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

  const playButton = (
    <PlayButton
      mediaId={cardInfo.mediaId?.id}
      isPlaying={isPlaying}
      onPlayStatus={onPlayStatus}
      onPlayEnd={handlePlayEnd}
    />
  );

  return (
    <Card
      elevation={3}
      id={passageId ? `passage-card-${passageId}` : undefined}
      data-cy={passageId ? `passage-card-${passageId}` : undefined}
      aria-current={isCurrent ? 'true' : undefined}
      sx={{
        minWidth: isMobileWidth ? '100%' : 275,
        maxWidth: 400,
        minHeight: isMobileWidth ? minPassageCardHeight : cardHeight,
        display: 'flex',
        flexDirection: 'column',
        p: 2,
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
          gap: 1,
          flex: 1,
        }}
      >
        <PassageCardHeader
          cardInfo={cardInfo}
          passageRef={ref}
          comment={comment}
          psgType={psgType}
          onGraphicClick={onGraphicClick}
        >
          {!isChapter && playButton}
        </PassageCardHeader>
        {cardInfo.kind === IwsKind.SectionPassage && (
          <PassageRef
            psgType={psgType}
            book={cardInfo.book}
            passageRef={ref}
            comment={comment}
          />
        )}
        {isChapter ? (
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
        ) : (
          <>
            <Typography variant="body2" color="grey">
              {comment}
            </Typography>
            {!isPersonal && <PassageAssignee assign={cardInfo.assign} />}
            <PassageStepButton step={cardInfo.step} onClick={handleViewStep} />
          </>
        )}
      </Box>
    </Card>
  );
}
