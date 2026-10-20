import { ISheet, PassageTypeEnum } from '../../model';
import { Box, Card, Stack, Typography } from '@mui/material';
import { passageTypeFromRef } from '../../control/passageTypeFromRef';
import { PassageSpeakerButton } from './PassageSpeakerButton';
import { PassageCardHeader } from './PassageCardHeader';
import { PassageAssignee } from './PassageAssignee';
import { PassageStepButton } from './PassageStepButton';
import { useMobile } from '../../utils';
import { useCardHeight, useMeasureCardHeight } from '../CardSize/useCardSize';

const minPassageCardHeight = 176;

interface IProps {
  cardInfo: ISheet;
  handleViewStep: () => void;
  onGraphicClick?: () => void;
  isPersonal?: boolean;
  isCurrent?: boolean;
}

export function PassageCard(props: IProps) {
  const { isMobileWidth } = useMobile();
  const { cardInfo, handleViewStep, onGraphicClick, isPersonal, isCurrent } =
    props;
  const noteTitle = cardInfo?.sharedResource?.attributes.title;
  // Unsaved rows have no passage record yet, so fall back to the row fields.
  const ref =
    noteTitle || cardInfo.passage?.attributes.reference || cardInfo.reference;

  const description =
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

  const mediaId = cardInfo.mediaId?.id;

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
        position: 'relative',
        px: 2,
        py: 1.5,
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
          gap: isChapter ? 0 : 1.5,
          flex: 1,
        }}
      >
        {isChapter ? (
          <>
            <PassageCardHeader
              cardInfo={cardInfo}
              passageRef={ref}
              description={description}
              psgType={psgType}
              onGraphicClick={onGraphicClick}
            />
            {mediaId && (
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  pointerEvents: 'none',
                  '& > *': { pointerEvents: 'auto' },
                }}
              >
                <PassageSpeakerButton mediaId={mediaId} />
              </Box>
            )}
          </>
        ) : (
          <>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <PassageCardHeader
                cardInfo={cardInfo}
                passageRef={ref}
                description={description}
                psgType={psgType}
                onGraphicClick={onGraphicClick}
                mediaId={mediaId}
              />
              <Typography noWrap variant="body2" color="grey">
                {description}
              </Typography>
            </Box>
            <Stack justifyContent="flex-end" gap={1.5} minHeight={80}>
              {!isPersonal && cardInfo.assign && (
                <PassageAssignee assign={cardInfo.assign} />
              )}
              <PassageStepButton
                step={cardInfo.step}
                discussionCount={cardInfo.stepDiscussionCount}
                onClick={handleViewStep}
              />
            </Stack>
          </>
        )}
      </Box>
    </Card>
  );
}
