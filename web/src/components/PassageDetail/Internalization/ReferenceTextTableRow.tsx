import { Box } from '@mui/material';
import { TableRow } from './TableRow';
import { ReferenceTextActions } from './ReferenceTextActions';
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
}: Readonly<IProps>) {
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
            <ReferenceTextActions
              role={role}
              speaking={speaking}
              progress={progress}
              onPlay={onPlay}
              onView={onView}
              sx={{ justifyContent: 'center' }}
            />
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
