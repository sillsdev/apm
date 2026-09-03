import { ICardsStrings, ISheet, IwsKind, PassageTypeEnum } from '../../model';
import { Box, Card, CardContent, Typography } from '@mui/material';
import { ChevronRight, Person } from '@mui/icons-material';
import TaskAvatar from '../../components/TaskAvatar';
import { passageTypeFromRef } from '../../control/passageTypeFromRef';
import { PlayButton } from '../PlayButton';
import { cardsSelector } from '../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { PassageGraphic } from './PassageGraphic';
import { PassageRef } from './PassageRef';
import { useSectionIdDescription } from './useSectionIdDescription';
import { useMobile } from '../../utils';
import { Button } from '../../control/Button';

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
  const getDescription = useSectionIdDescription();
  const t: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const noteTitle = cardInfo?.sharedResource?.attributes.title;
  const ref = noteTitle || cardInfo.passage?.attributes.reference;

  const comment =
    cardInfo?.sharedResource?.attributes.description ||
    (noteTitle ? cardInfo.reference?.split('|')[1] : '') ||
    cardInfo.comment;

  const psgType = passageTypeFromRef(
    cardInfo.passage?.attributes.reference,
    false
  );

  const handlePlayEnd = () => {
    if (isPlaying) {
      onPlayStatus?.();
    }
  };

  const passageId = cardInfo.passage?.id;

  return (
    <Card
      elevation={3}
      id={passageId ? `passage-card-${passageId}` : undefined}
      data-cy={passageId ? `passage-card-${passageId}` : undefined}
      aria-current={isCurrent ? 'true' : undefined}
      sx={{
        minWidth: isMobileWidth ? '100%' : 275,
        maxWidth: 400,
        ...(isCurrent && {
          outline: '2px solid',
          outlineColor: 'primary.light',
          outlineOffset: 2,
        }),
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <PassageGraphic
            cardInfo={cardInfo}
            reference={ref}
            psgType={psgType}
            onClick={onGraphicClick}
          />
          {cardInfo.kind === IwsKind.Passage ? (
            <PassageRef
              psgType={psgType}
              book={cardInfo.book}
              passageRef={ref}
              comment={comment}
            />
          ) : (
            <Typography variant="h6">{getDescription(cardInfo)}</Typography>
          )}
          {psgType !== PassageTypeEnum.CHAPTERNUMBER ? (
            <PlayButton
              mediaId={cardInfo.mediaId?.id}
              isPlaying={isPlaying}
              onPlayStatus={onPlayStatus}
              onPlayEnd={handlePlayEnd}
            />
          ) : (
            <></>
          )}
        </Box>
        {cardInfo.kind === IwsKind.SectionPassage && (
          <PassageRef
            psgType={psgType}
            book={cardInfo.book}
            passageRef={ref}
            comment={comment}
          />
        )}
        {psgType !== PassageTypeEnum.CHAPTERNUMBER ? (
          <>
            <Typography variant="body2" color="grey">
              {comment || '\u00A0'}
            </Typography>
            {!isPersonal && (
              <Box sx={{ margin: '1.5rem 0 .5rem 0' }}>
                {cardInfo.assign ? (
                  <TaskAvatar assigned={cardInfo?.assign || null} />
                ) : (
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                    }}
                  >
                    <Person sx={{ verticalAlign: 'middle', mb: '.5rem' }} />
                    {t.unassigned || 'Unassigned'}
                  </Box>
                )}
              </Box>
            )}
            <Button
              data-cy="passage-card-step"
              sx={{
                width: '100%',
                position: 'relative',
                '& .MuiTypography-root': {
                  fontWeight: 'bold',
                  maxWidth: '80%',
                },
                '& .MuiButton-endIcon': {
                  position: 'absolute',
                  right: 12,
                  m: 0,
                },
              }}
              color="primary"
              endIcon={<ChevronRight />}
              onClick={handleViewStep}
            >
              {cardInfo.step}
            </Button>
          </>
        ) : (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-around',
              mt: 2,
            }}
          >
            <PlayButton
              mediaId={cardInfo.mediaId?.id}
              isPlaying={isPlaying && psgType === PassageTypeEnum.CHAPTERNUMBER}
              onPlayStatus={onPlayStatus}
              onPlayEnd={handlePlayEnd}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
