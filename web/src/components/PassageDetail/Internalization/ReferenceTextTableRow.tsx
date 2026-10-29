import { Box, Stack } from '@mui/material';
import { TableRow } from './TableRow';
import { ReferenceTextPlayButton } from './ReferenceTextPlayButton';
import { ViewButton } from './ViewButton';
import { ReferenceTextStatus } from './ReferenceTextStatus';
import { ReferenceTextItemProps } from './referenceTextItem';
import { useReferenceTextLabels } from './useReferenceTextLabels';

interface IProps extends ReferenceTextItemProps {
  passageId: string;
  showDragHandle?: boolean;
}

/** A Reference Text in the desktop Internalize table: no drag, done or edit. */
export function ReferenceTextTableRow({
  role,
  passage,
  speaking,
  progress,
  onPlay,
  onView,
  passageId,
  showDragHandle,
}: IProps) {
  const { referenceText } = passage;
  const labels = useReferenceTextLabels(referenceText, role);
  const ready = passage.status === 'ready';

  return (
    <Box data-cy={`reference-text-${role}`}>
      <TableRow
        showDragHandle={showDragHandle}
        fixed
        value={{
          passageId,
          playItem: ready && (
            <Stack direction="row" sx={{ justifyContent: 'center' }}>
              <ReferenceTextPlayButton
                speaking={speaking}
                progress={progress}
                onClick={() => onPlay(role)}
              />
              <ViewButton id={role} cb={() => onView(role)} />
            </Stack>
          ),
          artifactName: (
            <>
              <span dir={referenceText.textDirection}>{labels.bible}</span>
              <ReferenceTextStatus passage={passage} />
            </>
          ),
          version: null,
          artifactType: labels.role,
          artifactCategory: labels.language,
          done: null,
          editAction: null,
        }}
      />
    </Box>
  );
}

export default ReferenceTextTableRow;
