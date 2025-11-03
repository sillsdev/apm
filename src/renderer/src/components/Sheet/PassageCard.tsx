import { ISheet } from '../../model';
import { Button, Card, CardContent, Typography } from '@mui/material';
import {
  ArrowForwardIos,
  Person,
  PlayCircleOutline,
  PauseCircleOutline,
} from '@mui/icons-material';

interface IProps {
  cardInfo: ISheet;
  getBookName: (bookAbbreviation: string | undefined) => string;
  handleViewStep: () => void;
  onPlayStatus?: () => void;
  isPlaying: boolean;
}

export function PassageCard(props: IProps) {
  const { cardInfo, getBookName, handleViewStep, onPlayStatus, isPlaying } =
    props;

  const fullBookName = getBookName(cardInfo.book);

  const assignedGroup = cardInfo.assign
    ? String(cardInfo.assign)
    : 'Unassigned';

  return (
    <Card sx={{ border: '2px solid black' }}>
      <CardContent>
        <Typography variant="h6">
          {fullBookName} {cardInfo.passage?.attributes.reference}
          {cardInfo.mediaId?.id ? (
            <Button
              variant="text"
              sx={{
                minWidth: 0,
                p: 0,
                ml: 1,
                width: 48,
                height: 48,
                backgroundColor: 'transparent',
                '&:hover': {
                  backgroundColor: '#f0f0f0',
                },
                borderRadius: '50%',
              }}
              onClick={onPlayStatus}
            >
              {isPlaying ? (
                <PauseCircleOutline
                  sx={{ verticalAlign: 'middle' }}
                  fontSize="large"
                />
              ) : (
                <PlayCircleOutline
                  sx={{ verticalAlign: 'middle' }}
                  fontSize="large"
                />
              )}
            </Button>
          ) : (
            <Button
              variant="text"
              sx={{
                minWidth: 0,
                p: 0,
                ml: 1,
                width: 48,
                height: 48,
                backgroundColor: 'transparent',
                '&:hover': {
                  backgroundColor: '#f0f0f0',
                },
                borderRadius: '50%',
              }}
              onClick={undefined}
            >
              <PlayCircleOutline
                sx={{ verticalAlign: 'middle' }}
                fontSize="large"
                color="disabled"
              />
            </Button>
          )}
        </Typography>
        <Typography variant="body2" color="grey" sx={{ mt: 1 }}>
          {cardInfo.comment || '\u00A0'}
        </Typography>
        <Typography sx={{ margin: '1rem 0' }}>
          <Person sx={{ verticalAlign: 'middle', mb: '.5rem' }} />
          {assignedGroup}
        </Typography>
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
