import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  List,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { shallowEqual, useSelector } from 'react-redux';
import { ttsVoicesSelector } from '../../../selector';
import { ITtsVoicesStrings } from '../../../model';
import type { VoiceGroup } from '../../../business/referenceText/voiceGroups';
import type { RankedVoice } from '../../../business/referenceText/voiceRanking';
import { VoiceRowItem } from './VoiceRowItem';

export interface VoiceLanguageGroupProps {
  group: VoiceGroup;
  /** voiceURI of the voice reading the sample now. */
  reading?: string;
  noSample: boolean;
  onRead: (voice: SpeechSynthesisVoice) => void;
  onRank: (voice: RankedVoice) => void;
  onUnrank: (voice: RankedVoice) => void;
  onMove: (voice: RankedVoice, delta: -1 | 1) => void;
}

/** A language's voices, ranked ones first; open from the start when the language was ranked. */
export function VoiceLanguageGroup(props: VoiceLanguageGroupProps) {
  const { group, reading, noSample, onRead, onRank, onUnrank, onMove } = props;
  const t: ITtsVoicesStrings = useSelector(ttsVoicesSelector, shallowEqual);
  const rankedCount = group.rows.filter((r) => r.rank !== undefined).length;
  const summaryId = `tts-lang-${group.language}`;

  return (
    <Accordion
      disableGutters
      defaultExpanded={group.tier === 'ranked'}
      // A browser can list hundreds of voices; render only open languages.
      slotProps={{ transition: { unmountOnExit: true } }}
    >
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        id={summaryId}
        aria-controls={`${summaryId}-content`}
      >
        <Typography sx={{ flex: 1 }}>
          {group.label}{' '}
          <Typography component="span" variant="caption" color="text.secondary">
            {group.language}
          </Typography>
        </Typography>
        {rankedCount > 0 && (
          <Typography variant="caption" color="primary" sx={{ mr: 1 }}>
            {t.rankedCount.replace('{0}', String(rankedCount))}
          </Typography>
        )}
      </AccordionSummary>
      <AccordionDetails id={`${summaryId}-content`} sx={{ pt: 0 }}>
        <List dense disablePadding>
          {group.rows.map((row) => {
            const { device } = row;
            return (
              <VoiceRowItem
                key={row.voice.voiceURI}
                row={row}
                rankedCount={rankedCount}
                reading={Boolean(device) && reading === device?.voiceURI}
                noSample={noSample}
                onRead={() => device && onRead(device)}
                onRank={() => onRank(row.voice)}
                onUnrank={() => onUnrank(row.voice)}
                onMove={(delta) => onMove(row.voice, delta)}
              />
            );
          })}
        </List>
      </AccordionDetails>
    </Accordion>
  );
}
