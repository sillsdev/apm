import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  Badge,
  Checkbox,
  CircularProgress,
  FormControl,
  FormControlLabel,
  FormLabel,
  List,
  ListItem,
  ListItemText,
  Paper,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { getLangTag } from 'mui-language-picker';
import { shallowEqual, useSelector } from 'react-redux';
import { ITranscriberStrings } from '../../model';
import { transcriberSelector } from '../../selector';
import { AsrAlphabet } from './AsrAlphabet';
import { asrScriptDetail } from './asrScriptDetail';
import { needsSisterLanguage } from './asrLanguages';
import { isLangSet } from '../../utils/langTag';
import scriptNameData from '../../assets/scriptName';
import { AsrTarget } from './AsrTarget';
import { IAsrState } from './asrState';
import { IAsrLanguageSuggestion } from './useRecommendAsrLanguage';

interface IAsrSettings {
  asr: IAsrState;
  setAsr: Dispatch<SetStateAction<IAsrState | undefined>>;
  /** Primary (vernacular) language; decides whether a sister language is needed. */
  vernacularBcp47: string;
  /** Recommendation data for the sister-language picker (owned by the parent). */
  suggestions: IAsrLanguageSuggestion[];
  loading: boolean;
  error: string;
  /** Remounts the sister picker when the primary language changes. */
  recommendKey?: string;
}

/**
 * The shared "AI Automatic Transcription" controls: transcription type, the
 * transliterate option, and (when the vernacular language can't be transcribed
 * directly) the sister-language picker plus recommendations. Used by both the
 * transcribe step editor and the run-time ASR dialog so they stay in sync.
 */
export const AsrSettings = ({
  asr,
  setAsr,
  vernacularBcp47,
  suggestions,
  loading,
  error,
  recommendKey,
}: IAsrSettings) => {
  const t: ITranscriberStrings = useSelector(transcriberSelector, shallowEqual);
  const [scriptName] = useState(
    () => new Map(scriptNameData as [string, string][])
  );

  const needsSister = needsSisterLanguage(vernacularBcp47);
  const phonetic = asr.target === AsrTarget.phonetic;

  // When the vernacular is itself the ASR language, transliterate is governed by
  // the vernacular's script (AsrAlphabet handles this for the sister case).
  const vernacularShowRoman = useMemo(() => {
    if (!isLangSet(vernacularBcp47)) return false;
    return asrScriptDetail({ langTag: getLangTag(vernacularBcp47), scriptName })
      .showRoman;
  }, [vernacularBcp47, scriptName]);

  const handleTargetChange = (_e: unknown, value: string) => {
    const nextPhonetic = value === AsrTarget.phonetic;
    setAsr((prev) =>
      prev
        ? {
            ...prev,
            target: value as AsrTarget,
            // Transliterate only applies to script transcription.
            selectRoman: nextPhonetic ? false : prev.selectRoman,
          }
        : prev
    );
  };

  const handleRomanChange = (_e: unknown, checked: boolean) => {
    setAsr((prev) => (prev ? { ...prev, selectRoman: checked } : prev));
  };

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      <FormControl component="fieldset" variant="standard">
        <FormLabel component="legend">{t.transcriptionType}</FormLabel>
        <RadioGroup row value={asr.target} onChange={handleTargetChange}>
          <FormControlLabel
            value={AsrTarget.alphabet}
            control={<Radio />}
            label={t.scriptTranscription}
          />
          <FormControlLabel
            value={AsrTarget.phonetic}
            control={<Radio />}
            label={
              <Badge
                badgeContent={<InfoIcon color={'info'} fontSize="small" />}
                title={t.phoneticTip}
              >
                {t.phonetic}
              </Badge>
            }
          />
        </RadioGroup>
      </FormControl>
      {!needsSister && vernacularShowRoman && (
        <FormControlLabel
          sx={{ ml: 1 }}
          control={
            <Checkbox
              checked={asr.selectRoman ?? false}
              onChange={handleRomanChange}
              disabled={phonetic}
            />
          }
          label={t.transliterate}
        />
      )}
      {needsSister && (
        <>
          <Typography variant="body2" sx={{ ml: 1 }}>
            {t.sisterLang}
          </Typography>
          {loading ? (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ ml: 1, my: 1 }}
            >
              <CircularProgress size={16} />
              <Typography variant="body2">{t.findingSisterLang}</Typography>
            </Stack>
          ) : (
            <Stack spacing={1} sx={{ ml: 1 }}>
              {error && (
                <Typography variant="body2" color="error">
                  {error}
                </Typography>
              )}
              <AsrAlphabet
                key={`sister-${recommendKey ?? vernacularBcp47}`}
                state={asr}
                setState={setAsr}
              />
              {suggestions.length > 0 && (
                <Paper
                  variant="outlined"
                  sx={{ p: 1, bgcolor: 'action.hover' }}
                >
                  <Stack
                    direction="row"
                    spacing={0.5}
                    alignItems="center"
                    sx={{ mb: 0.5 }}
                  >
                    <InfoIcon fontSize="small" color="info" />
                    <Typography variant="subtitle2">{t.recommended}</Typography>
                  </Stack>
                  <List dense disablePadding>
                    {suggestions.map((s, i) => (
                      <ListItem
                        key={`sister-suggestion-${i}`}
                        disableGutters
                        sx={{ py: 0.25, alignItems: 'flex-start' }}
                      >
                        <ListItemText
                          primary={s.languageName || s.iso}
                          secondary={s.reason}
                          slotProps={{
                            primary: { variant: 'body2', fontWeight: 600 },
                            secondary: { variant: 'caption' },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Paper>
              )}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
};
