import { ICardsStrings, ISheet, IwsKind, PassageTypeEnum } from '../../model';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
} from '@mui/material';
import { ArrowForwardIos, Person } from '@mui/icons-material';
import TaskAvatar from '../../components/TaskAvatar';
import { passageTypeFromRef } from '../../control/passageTypeFromRef';
import { PlayButton } from '../PlayButton';
import { cardsSelector } from '../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { PassageGraphic } from './PassageGraphic';
import { PassageRef } from './PassageRef';
import { useSectionIdDescription } from './useSectionIdDescription';
import { useMobile } from '../../utils';

interface IProps {
  cardInfo: ISheet;
  handleViewStep: () => void;
  onPlayStatus?: () => void;
  isPlaying: boolean;
  isPersonal?: boolean;
}

export function PassageCard(props: IProps) {
  const { isMobileWidth } = useMobile();
  const { cardInfo, handleViewStep, onPlayStatus, isPlaying, isPersonal } =
    props;
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

  return (
    <Card
      elevation={3}
      sx={{ minWidth: isMobileWidth ? '100%' : 275, maxWidth: 400 }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <PassageGraphic
            cardInfo={cardInfo}
            reference={ref}
            psgType={psgType}
          />
          {cardInfo.kind === IwsKind.Passage ? (
            <PassageRef
              psgType={psgType}
              book={cardInfo.book}
              ref={ref}
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
            ref={ref}
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
              variant="contained"
              sx={{ width: '100%', position: 'relative', px: 1 }}
              onClick={handleViewStep}
            >
              <span
                style={{
                  display: 'block',
                  textAlign: 'center',
                  width: '100%',
                  fontWeight: 'bold',
                }}
              >
                {cardInfo.step}
              </span>
              <ArrowForwardIos
                sx={{
                  position: 'absolute',
                  right: 8,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                  fontSize: 'medium',
                }}
              />
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
