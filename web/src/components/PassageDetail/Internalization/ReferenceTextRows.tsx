import { useState } from 'react';
import { Box, List, ListItem } from '@mui/material';
import {
  ReferenceTextRole,
  useReferenceTextPassage,
} from '../../../business/referenceText/useReferenceTextPassage';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { ReferenceTextCard } from './mobile components/ReferenceTextCard';
import { ReferenceTextDialog } from './ReferenceTextDialog';
import { ReferenceTextTableRow } from './ReferenceTextTableRow';
import { ShownReferenceTextPassage } from './referenceTextItem';
import { useReferenceTextSpeech } from './useReferenceTextSpeech';

// Matches VertListDnd's leading drag gutter (40px plus its 0.5 gap), so cards line up
const MOBILE_DRAG_GUTTER = '44px';

interface IProps {
  variant: 'table' | 'card';
  /** Whether the sortable list below shows drag handles, so these rows line up with it. */
  showDragHandle?: boolean;
  expandedId?: string | null;
  setExpandedId?: (id: string | null) => void;
}

interface Viewing {
  role: ReferenceTextRole;
  notice?: 'noVoice' | 'speakFailed';
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
}: IProps) {
  const { passage } = usePassageDetailContext();
  const primary = useReferenceTextPassage(passage, 'primary');
  const secondary = useReferenceTextPassage(passage, 'secondary');
  const speech = useReferenceTextSpeech();
  const [viewing, setViewing] = useState<Viewing>();

  const shown = (
    [
      ['primary', primary],
      ['secondary', secondary],
    ] as const
  ).filter(
    (entry): entry is [ReferenceTextRole, ShownReferenceTextPassage] =>
      entry[1].status !== 'none'
  );
  const viewed = viewing?.role === 'secondary' ? secondary : primary;

  const handlePlay = async (role: ReferenceTextRole) => {
    const value = role === 'primary' ? primary : secondary;
    if (value.status !== 'ready') return;
    const outcome = await speech.toggle(role, value.referenceText, value.text);
    if (outcome === 'noVoice') setViewing({ role, notice: 'noVoice' });
    else if (outcome === 'error') setViewing({ role, notice: 'speakFailed' });
  };
  const handleView = (role: ReferenceTextRole) => setViewing({ role });
  const itemProps = (role: ReferenceTextRole) => ({
    speaking: speech.speaking === role,
    progress: speech.speaking === role ? speech.progress : 0,
    // speech.toggle never rejects
    onPlay: (r: ReferenceTextRole) => void handlePlay(r),
    onView: handleView,
  });

  if (shown.length === 0) return null;

  return (
    <>
      {variant === 'table' ? (
        <List sx={{ px: 1, pb: 0 }}>
          {shown.map(([role, value]) => (
            <ListItem key={role}>
              <ReferenceTextTableRow
                role={role}
                passage={value}
                passageId={passage.id}
                showDragHandle={showDragHandle}
                {...itemProps(role)}
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
          {shown.map(([role, value]) => (
            <ReferenceTextCard
              key={role}
              role={role}
              passage={value}
              {...itemProps(role)}
              expandedId={expandedId}
              setExpandedId={setExpandedId ?? (() => undefined)}
            />
          ))}
        </Box>
      )}
      {viewing && viewed.status === 'ready' && (
        <ReferenceTextDialog
          role={viewing.role}
          referenceText={viewed.referenceText}
          text={viewed.text}
          passage={passage}
          mobile={variant === 'card'}
          notice={viewing.notice}
          onClose={() => setViewing(undefined)}
        />
      )}
    </>
  );
}

export default ReferenceTextRows;
