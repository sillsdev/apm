import { Box, Card, SxProps, Typography } from '@mui/material';
import { WrapTitle } from '../../../../control/WrapTitle';
import { ReferenceTextPlayButton } from '../ReferenceTextPlayButton';
import { ViewButton } from '../ViewButton';
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
  role,
  passage,
  speaking,
  progress,
  onPlay,
  onView,
  expandedId,
  setExpandedId,
  sx,
}: IProps) {
  const { referenceText } = passage;
  const labels = useReferenceTextLabels(referenceText, role);

  return (
    <Card
      elevation={0}
      data-cy={`reference-text-${role}`}
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
          id={`reference-text-${role}`}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          typographyProps={{ variant: 'h6', sx: { lineHeight: 1.25 } }}
        >
          {labels.bible}
        </WrapTitle>
      </Box>
      <Typography variant="body1" sx={{ lineHeight: 1.25 }}>
        {labels.role} · {labels.language}
      </Typography>
      <ReferenceTextStatus passage={passage} />
      {passage.status === 'ready' && (
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <ReferenceTextPlayButton
            speaking={speaking}
            progress={progress}
            onClick={() => onPlay(role)}
          />
          <ViewButton id={role} cb={() => onView(role)} />
        </Box>
      )}
    </Card>
  );
}

export default ReferenceTextCard;
