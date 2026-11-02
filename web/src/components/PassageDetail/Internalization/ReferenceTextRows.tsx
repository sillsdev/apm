import { Box, List, ListItem } from '@mui/material';
import { ReferenceTextCard } from './mobile components/ReferenceTextCard';
import { ReferenceTextDialog } from './ReferenceTextDialog';
import { ReferenceTextTableRow } from './ReferenceTextTableRow';
import { useReferenceTextPlayback } from './useReferenceTextPlayback';
import { useShownReferenceTexts } from './useShownReferenceTexts';

// Matches VertListDnd's leading drag gutter (40px plus its 0.5 gap), so cards line up
const MOBILE_DRAG_GUTTER = '44px';

interface IProps {
  variant: 'table' | 'card';
  /** Whether the sortable list below shows drag handles, so these rows line up with it. */
  showDragHandle?: boolean;
  expandedId?: string | null;
  setExpandedId?: (id: string | null) => void;
}

/**
 * The project's Primary then Secondary Reference Text for the current passage,
 * shown above the Internalize list and outside rowData (ADR 0014).
 */
export function ReferenceTextRows({
  variant,
  showDragHandle,
  expandedId,
  setExpandedId,
}: Readonly<IProps>) {
  const { passage, passages, shown } = useShownReferenceTexts();
  const { itemProps, viewing, closeView } = useReferenceTextPlayback(passages);

  if (shown.length === 0) return null;

  return (
    <>
      {variant === 'table' ? (
        <List sx={{ px: 1, pb: 0 }}>
          {shown.map(([rank, value]) => (
            <ListItem key={rank}>
              <ReferenceTextTableRow
                rank={rank}
                passage={value}
                passageId={passage.id}
                showDragHandle={showDragHandle}
                {...itemProps(rank)}
              />
            </ListItem>
          ))}
        </List>
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
            pt: 1,
            pl: showDragHandle ? MOBILE_DRAG_GUTTER : 0,
          }}
        >
          {shown.map(([rank, value]) => (
            <ReferenceTextCard
              key={rank}
              rank={rank}
              passage={value}
              {...itemProps(rank)}
              expandedId={expandedId}
              setExpandedId={setExpandedId ?? (() => undefined)}
            />
          ))}
        </Box>
      )}
      {viewing && (
        <ReferenceTextDialog
          {...viewing}
          passage={passage}
          mobile={variant === 'card'}
          onClose={closeView}
        />
      )}
    </>
  );
}

export default ReferenceTextRows;
