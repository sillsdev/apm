import { ISheet, PassageTypeEnum } from '../../model';
import { Box, Card, Chip, Stack, Typography } from '@mui/material';
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

export function PassageCard({
  cardInfo,
  handleViewStep,
  onGraphicClick,
  isPersonal,
  isCurrent,
}: IProps) {
  const { isMobileWidth } = useMobile();
  const noteTitle = cardInfo.sharedResource?.attributes.title;
  // Unsaved rows have no passage record yet, so fall back to the row fields.
  const ref =
    noteTitle || cardInfo.passage?.attributes.reference || cardInfo.reference;

  const noteCategory = noteTitle ? cardInfo.reference?.split('|')[1] : '';
  const description =
    cardInfo.sharedResource?.attributes.description || cardInfo.comment;

  const psgType = cardInfo.passage
    ? passageTypeFromRef(cardInfo.passage.attributes.reference, false)
    : cardInfo.passageType;

  const passageId = cardInfo.passage?.id;
  const isChapter = psgType === PassageTypeEnum.CHAPTERNUMBER;
  const mediaId = cardInfo.mediaId?.id;

  const cardHeight = useCardHeight(minPassageCardHeight);
  const contentRef = useMeasureCardHeight(
    isChapter || isMobileWidth
      ? undefined
      : (passageId ?? `${cardInfo.sectionId?.id}-${cardInfo.passageSeq}`)
  );

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
      <Stack ref={contentRef} flex={1} justifyContent="space-between" gap={1.5}>
        <Stack gap={1.5}>
          <PassageCardHeader
            cardInfo={cardInfo}
            passageRef={ref}
            description={description}
            psgType={psgType}
            onGraphicClick={onGraphicClick}
            mediaId={isChapter ? undefined : mediaId}
          />
          {!isChapter && (
            <Typography noWrap variant="body2" color="grey">
              {description}
            </Typography>
          )}
        </Stack>
        {!isChapter && (
          <Stack justifyContent="flex-end" gap={1.5} minHeight={80}>
            <Stack
              direction="row"
              justifyContent="flex-end"
              alignItems="center"
            >
              {noteCategory && (
                <Chip size="small" sx={{ mr: 'auto' }} label={noteCategory} />
              )}
              {!isPersonal && cardInfo.assign && (
                <PassageAssignee assign={cardInfo.assign} />
              )}
            </Stack>
            <PassageStepButton
              step={cardInfo.step}
              discussionCount={cardInfo.stepDiscussionCount}
              onClick={handleViewStep}
            />
          </Stack>
        )}
      </Stack>
      {isChapter && mediaId && (
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
    </Card>
  );
}
