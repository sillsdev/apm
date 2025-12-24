import { ISheet, PassageTypeEnum } from '../../model';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  ArrowForwardIos,
  Person,
  PlayCircleOutline,
} from '@mui/icons-material';
import TaskAvatar from '../../components/TaskAvatar';
import { passageTypeFromRef } from '../../control/passageTypeFromRef';
import { RefRender } from '../../control/RefRender';
import { LoadAndPlay } from '../LoadAndPLay';
import AudioProgressButton from '../AudioProgressButton';

interface IProps {
  cardInfo: ISheet;
  getBookName: (bookAbbreviation: string | undefined) => string;
  handleViewStep: () => void;
  onPlayStatus?: () => void;
  isPlaying: boolean;
}

export function PassageCard(props: IProps) {
  const theme = useTheme();
  const mobileWidth = useMediaQuery(theme.breakpoints.down('sm'));
  const { cardInfo, getBookName, handleViewStep, onPlayStatus, isPlaying } =
    props;

  const fullBookName = getBookName(cardInfo.book);

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
      sx={{ minWidth: mobileWidth ? '100%' : 275, maxWidth: 400 }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography variant="h6">
            {psgType === PassageTypeEnum.PASSAGE ? (
              `${fullBookName} ${ref}`
            ) : ref ? (
              <RefRender value={ref} pt={psgType} fontSize={'0.8rem'} />
            ) : null}
          </Typography>
          {cardInfo.mediaId?.id && isPlaying ? (
            <LoadAndPlay
              Component={AudioProgressButton}
              srcMediaId={cardInfo.mediaId?.id}
              requestPlay={isPlaying}
              onEnded={handlePlayEnd}
              onTogglePlay={onPlayStatus}
              sx={{ width: 40, height: 40 }}
            />
          ) : cardInfo.mediaId?.id ? (
            <IconButton onClick={onPlayStatus}>
              <PlayCircleOutline fontSize="large" color="primary" />
            </IconButton>
          ) : (
            <Box
              sx={{
                display: 'inline-flex',
                ml: 1,
                mt: '-.25rem',
                width: 40,
                height: 40,
                borderRadius: '50%',
                verticalAlign: 'middle',
              }}
            />
          )}
        </Box>
        <Typography variant="body2" color="grey">
          {comment || '\u00A0'}
        </Typography>
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
              {'Unassigned'}
            </Box>
          )}
        </Box>
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
      </CardContent>
    </Card>
  );
}
