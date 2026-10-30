import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { cardsSelector, ttsVoicesSelector } from '../../../selector';
import { ICardsStrings, IState, ITtsVoicesStrings } from '../../../model';
import {
  orgDefaultTtsFilterRefText,
  orgDefaultTtsVoices,
  useOrgDefaults,
} from '../../../crud/useOrgDefaults';
import { languageLabel } from '../../../business/referenceText/referenceText';
import {
  moveRankedVoice,
  parseVoiceRanking,
  rankedLanguages,
  rankVoice,
  unrankVoice,
  voiceLanguage,
  type VoiceRanking,
} from '../../../business/referenceText/voiceRanking';
import {
  voiceGroups,
  type VoiceGroup,
} from '../../../business/referenceText/voiceGroups';
import { useTeamReferenceTexts } from '../../../business/referenceText/useTeamReferenceTextIds';
import { useDeviceVoices, type DeviceVoices } from './useDeviceVoices';
import { useShowOnlineVoices } from './useShowOnlineVoices';
import { useVoiceSample } from './useVoiceSample';
import {
  VoiceLanguageGroup,
  type VoiceLanguageGroupProps,
} from './VoiceLanguageGroup';
import { VoiceInstallNote } from './VoiceInstallNote';

export interface ReferenceTextVoicesDialogProps {
  /** Organization id whose defaults hold the Voice Ranking. */
  team: string;
  onClose: () => void;
}

type GroupHandlers = Omit<VoiceLanguageGroupProps, 'group'>;

interface VoiceGroupListProps extends GroupHandlers {
  device: DeviceVoices;
  groups: VoiceGroup[];
  searching: boolean;
}

function VoiceGroupList(props: VoiceGroupListProps) {
  const { device, groups, searching, ...handlers } = props;
  const t: ITtsVoicesStrings = useSelector(ttsVoicesSelector, shallowEqual);

  if (device.status === 'loading')
    return (
      <Box>
        <Typography variant="body2">{t.loading}</Typography>
        <LinearProgress />
      </Box>
    );
  return (
    <Box>
      {device.voices.length === 0 && (
        <Alert severity="info" sx={{ mb: 1 }}>
          {t.noVoices}
        </Alert>
      )}
      {searching && groups.length === 0 && (
        <Typography variant="body2">{t.noMatch}</Typography>
      )}
      {groups.map((group) => (
        <VoiceLanguageGroup key={group.language} group={group} {...handlers} />
      ))}
    </Box>
  );
}

/**
 * Team admins rank, per language, the voices that read Reference Texts aloud
 * (ADR 0015), and choose whether Project Settings offers only Reference Texts
 * in ranked languages. Changes are kept only on Save.
 */
export function ReferenceTextVoicesDialog(
  props: ReferenceTextVoicesDialogProps
) {
  const { team, onClose } = props;
  const t: ITtsVoicesStrings = useSelector(ttsVoicesSelector, shallowEqual);
  const tc: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const lang = useSelector((state: IState) => state.strings.lang);
  const { getOrgDefault, setOrgDefault } = useOrgDefaults();
  // Read once: the saved ranking orders the language groups while editing.
  const [savedRanking] = useState(() =>
    parseVoiceRanking(getOrgDefault(orgDefaultTtsVoices, team))
  );
  const [draftRanking, setDraftRanking] = useState<VoiceRanking>(savedRanking);
  const [draftFilter, setDraftFilter] = useState(
    () => getOrgDefault(orgDefaultTtsFilterRefText, team) === true
  );
  const [draftSample, setDraftSample] = useState<string>();
  const [search, setSearch] = useState('');
  const [showOnline, setShowOnline] = useShowOnlineVoices();
  const device = useDeviceVoices();
  const { reading, toggle } = useVoiceSample();
  const teamTexts = useTeamReferenceTexts(team);

  const usedLanguages = useMemo(
    () => new Set(teamTexts.map((r) => voiceLanguage(r.language))),
    [teamTexts]
  );
  const groups = useMemo(() => {
    if (device.status !== 'ready') return [];
    return voiceGroups({
      deviceVoices: device.voices,
      ranking: draftRanking,
      savedRanking,
      usedLanguages,
      showOnline,
      search,
      languageLabel: (language) => languageLabel({ language }, lang),
      collator: new Intl.Collator(lang),
    });
  }, [
    device,
    draftRanking,
    savedRanking,
    usedLanguages,
    showOnline,
    search,
    lang,
  ]);

  const hasRanking = rankedLanguages(draftRanking).size > 0;
  const sample = draftSample ?? t.sampleDefault;

  const handleSave = () => {
    setOrgDefault(orgDefaultTtsVoices, draftRanking, team);
    setOrgDefault(orgDefaultTtsFilterRefText, draftFilter && hasRanking, team);
    onClose();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby="ttsVoicesTitle"
      fullWidth
      maxWidth="sm"
      scroll="paper"
    >
      <DialogTitle id="ttsVoicesTitle">{t.title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Typography variant="body2">{t.explain}</Typography>
          <TextField
            id="tts-sample"
            label={t.sampleText}
            value={sample}
            onChange={(e) => setDraftSample(e.target.value)}
            multiline
            maxRows={3}
            size="small"
            fullWidth
          />
          <Box
            sx={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 2,
              alignItems: 'center',
            }}
          >
            <TextField
              id="tts-search"
              type="search"
              label={t.search}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              size="small"
              sx={{ flex: '1 1 200px' }}
            />
            <FormControlLabel
              control={
                <Checkbox
                  id="tts-show-online"
                  checked={showOnline}
                  onChange={(_e, checked) => setShowOnline(checked)}
                />
              }
              label={t.showOnline}
            />
          </Box>
          <VoiceGroupList
            device={device}
            groups={groups}
            searching={search.trim() !== ''}
            reading={reading}
            noSample={!sample.trim()}
            // toggle never rejects: speaking's done promise only resolves
            onRead={(voice) => void toggle(voice, sample)}
            onRank={(voice) => setDraftRanking((r) => rankVoice(r, voice))}
            onUnrank={(voice) => setDraftRanking((r) => unrankVoice(r, voice))}
            onMove={(voice, delta) =>
              setDraftRanking((r) => moveRankedVoice(r, voice, delta))
            }
          />
        </Stack>
      </DialogContent>
      <Box sx={{ px: 3, pt: 1 }}>
        <FormControlLabel
          control={
            <Checkbox
              id="tts-filter-reference-texts"
              checked={draftFilter && hasRanking}
              disabled={!hasRanking}
              onChange={(_e, checked) => setDraftFilter(checked)}
            />
          }
          label={t.filterReferenceTexts}
        />
        <VoiceInstallNote />
      </Box>
      <DialogActions>
        <Button id="tts-cancel" onClick={onClose}>
          {tc.cancel}
        </Button>
        <Button id="tts-save" variant="contained" onClick={handleSave}>
          {tc.save}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ReferenceTextVoicesDialog;
