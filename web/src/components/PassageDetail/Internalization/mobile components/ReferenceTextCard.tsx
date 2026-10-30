import { Box, Card, SxProps, Typography } from '@mui/material';
import { WrapTitle } from '../../../../control/WrapTitle';
import { ReferenceTextActions } from '../ReferenceTextActions';
import { ReferenceTextStatus } from '../ReferenceTextStatus';
import { ReferenceTextItemProps } from '../referenceTextItem';
import { useReferenceTextLabels } from '../useReferenceTextLabels';

interface IProps extends ReferenceTextItemProps {
  expandedId?: string | null;
  setExpandedId: (id: string | null) => void;
  sx?: SxProps;
}

// A Reference Text in the mobile Internalize list. Unlike TextResourceCard it
// has no done checkbox (nowhere to keep a per-user "listened" state, ADR 0014)
// and no edit or delete, and every user sees it.
export function ReferenceTextCard({
  rank,
  passage,
  speaking,
  progress,
  onPlay,
  onView,
  expandedId,
  setExpandedId,
  sx,
}: Readonly<IProps>) {
  const { referenceText } = passage;
  const labels = useReferenceTextLabels(referenceText, rank);

  return (
    <Card
      elevation={0}
      data-cy={`reference-text-${rank}`}
      sx={{
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 0.5,
        border: '2px solid',
        borderColor: 'grey.700',
        borderRadius: 2,
        backgroundColor: 'background.paper',
        px: 0.5,
        py: 1,
        ...sx,
      }}
    >
      <Box dir={referenceText.textDirection} sx={{ minWidth: 0 }}>
        <WrapTitle
          id={`reference-text-${rank}`}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          typographyProps={{ variant: 'h6', sx: { lineHeight: 1.25 } }}
        >
          {labels.bible}
        </WrapTitle>
      </Box>
      <Typography variant="body1" sx={{ lineHeight: 1.25 }}>
        {labels.rank} · {labels.language}
      </Typography>
      <ReferenceTextStatus passage={passage} />
      {passage.status === 'ready' && (
        <ReferenceTextActions
          rank={rank}
          speaking={speaking}
          progress={progress}
          onPlay={onPlay}
          onView={onView}
        />
      )}
    </Card>
  );
}

export default ReferenceTextCard;
