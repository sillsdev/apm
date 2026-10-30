import { useState } from 'react';
import { Box, List, ListItem } from '@mui/material';
import {
  ReferenceTextRank,
  useProjectReferenceTexts,
  useReferenceTextPassage,
} from '../../../business/referenceText/useReferenceTextPassage';
import { byRank } from '../../../business/referenceText/referenceText';
import usePassageDetailContext from '../../../context/usePassageDetailContext';
import { ReferenceTextCard } from './mobile components/ReferenceTextCard';
import {
  ReferenceTextDialog,
  ReferenceTextNotice,
} from './ReferenceTextDialog';
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
  rank: ReferenceTextRank;
  notice?: ReferenceTextNotice;
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
  const { passage } = usePassageDetailContext();
  const referenceTexts = useProjectReferenceTexts();
  const primary = useReferenceTextPassage(
    passage,
    byRank('primary', referenceTexts)
  );
  const secondary = useReferenceTextPassage(
    passage,
    byRank('secondary', referenceTexts)
  );
  const speech = useReferenceTextSpeech();
  const [viewing, setViewing] = useState<Viewing>();

  const shown = (
    [
      ['primary', primary],
      ['secondary', secondary],
    ] as const
  ).filter(
    (entry): entry is [ReferenceTextRank, ShownReferenceTextPassage] =>
      entry[1].status !== 'none'
  );
  const passages = [primary, secondary];
  const viewed = byRank(viewing?.rank ?? 'primary', passages);

  const handlePlay = async (rank: ReferenceTextRank) => {
    const value = byRank(rank, passages);
    if (value.status !== 'ready') return;
    const outcome = await speech.toggle(rank, value.referenceText, value.text);
    if (outcome === 'noVoice') setViewing({ rank, notice: 'noVoice' });
    else if (outcome === 'error') setViewing({ rank, notice: 'speakFailed' });
  };
  const handleView = (rank: ReferenceTextRank) => setViewing({ rank });
  const itemProps = (rank: ReferenceTextRank) => ({
    speaking: speech.speaking === rank,
    progress: speech.speaking === rank ? speech.progress : 0,
    // speech.toggle never rejects
    onPlay: (r: ReferenceTextRank) => void handlePlay(r),
    onView: handleView,
  });

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
      {viewing && viewed.status === 'ready' && (
        <ReferenceTextDialog
          rank={viewing.rank}
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
