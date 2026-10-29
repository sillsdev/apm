import {
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
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
import { TokenContext } from '../../context/TokenProvider';
import { useGlobal } from '../../context/useGlobal';
import { logError, Severity } from '../../utils';
import { toError } from '../../utils/toError';
import { shallowEqual, useSelector } from 'react-redux';
import { ITranscriberStrings } from '../../model';
import { transcriberSelector } from '../../selector';
import { AsrAlphabet } from './AsrAlphabet';
import { asrScriptDetail } from './asrScriptDetail';
import {
  asrMethodDefaultValue,
  explicitAsrMethod,
  listedAsrMethod,
} from './asrMethod';
import {
  getMethodsForAsr,
  isoFromBcp47,
  specificAsrMethods,
} from './asrLanguages';
import { isLangSet } from '../../utils/langTag';
import scriptNameData from '../../assets/scriptName';
import { AsrTarget } from './AsrTarget';
import { useNeedsSisterLanguage } from './useNeedsSisterLanguage';
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
  const token = useContext(TokenContext)?.state?.accessToken ?? null;
  const [errorReporter] = useGlobal('errorReporter');
  const [scriptName] = useState(
    () => new Map(scriptNameData as [string, string][])
  );
  const sisterBcp47 = asr.language?.bcp47;
  const { needsSister: sisterAnswer, failed: sisterCheckFailed } =
    useNeedsSisterLanguage(vernacularBcp47);
  const needsSister = sisterAnswer === true;
  // Methods are listed for the sister when one is needed (or when there is no
  // primary language), else for the primary language.
  const methodBcp47 =
    needsSister || !isLangSet(vernacularBcp47)
      ? (sisterBcp47 ?? 'und')
      : vernacularBcp47;

  const [methodList, setMethodList] = useState<{
    forBcp47: string;
    methods?: string[];
    failed?: boolean;
  }>();
  useEffect(() => {
    // Wait for the sister check, which never answers offline (no token): an
    // empty list read as 'ready' would show the saved method as Default.
    if (sisterAnswer === undefined || !token) return;
    let cancelled = false;
    getMethodsForAsr(isoFromBcp47(methodBcp47), token)
      .then((methods) => {
        if (!cancelled) setMethodList({ forBcp47: methodBcp47, methods });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        logError(Severity.error, errorReporter, toError(err));
        setMethodList({ forBcp47: methodBcp47, failed: true });
      });
    return () => {
      cancelled = true;
    };
  }, [methodBcp47, sisterAnswer, token, errorReporter]);

  // A list loaded for another language (before a change) doesn't apply.
  const currentList =
    sisterAnswer !== undefined && methodList?.forBcp47 === methodBcp47
      ? methodList
      : undefined;
  const asrMethods = currentList?.methods ?? [];
  let loadStatus: 'loading' | 'ready' | 'failed' = 'loading';
  if (sisterCheckFailed || currentList?.failed) loadStatus = 'failed';
  else if (currentList?.methods) loadStatus = 'ready';

  const phonetic = asr.target === AsrTarget.phonetic;

  // When the vernacular is itself the ASR language, transliterate is governed by
  // the vernacular's script (AsrAlphabet handles this for the sister case).
  const vernacularShowRoman = useMemo(() => {
    if (!isLangSet(vernacularBcp47)) return false;
    return asrScriptDetail({ langTag: getLangTag(vernacularBcp47), scriptName })
      .showRoman;
  }, [vernacularBcp47, scriptName]);

  // No primary language known (e.g. an LWC step without one): the user picks
  // the ASR language itself in the same picker the sister language uses.
  const choosePrimary = !isLangSet(vernacularBcp47);
  const showLanguagePicker = needsSister || choosePrimary;

  const chosenMethod = explicitAsrMethod(asr.asrMethod);
  // What the method choice really is: a method the service no longer lists,
  // or now lists first, shows as Default. It is only dropped from the saved
  // settings when the user changes something here, never by rendering.
  const effectiveMethod =
    loadStatus === 'ready'
      ? listedAsrMethod(chosenMethod, asrMethods)
      : chosenMethod;

  const handleTargetChange = (_e: unknown, value: string) => {
    const nextPhonetic = value === AsrTarget.phonetic;
    setAsr((prev) =>
      prev
        ? {
            ...prev,
            target: value as AsrTarget,
            // Transliterate only applies to script transcription.
            selectRoman: nextPhonetic ? false : prev.selectRoman,
            asrMethod: effectiveMethod,
          }
        : prev
    );
  };

  const handleRomanChange = (_e: unknown, checked: boolean) => {
    setAsr((prev) =>
      prev
        ? { ...prev, selectRoman: checked, asrMethod: effectiveMethod }
        : prev
    );
  };

  const handleMethodChange = (_e: unknown, value: string) => {
    setAsr((prev) =>
      prev
        ? {
            ...prev,
            asrMethod: value === asrMethodDefaultValue ? undefined : value,
          }
        : prev
    );
  };

  const listedOptions = specificAsrMethods(asrMethods);
  const selectedMethod = effectiveMethod ?? asrMethodDefaultValue;

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
      {!showLanguagePicker && vernacularShowRoman && (
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
      {showLanguagePicker && (
        <>
          <Typography variant="body2" sx={{ ml: 1 }}>
            {choosePrimary ? t.asrChooseLanguage : t.sisterLang}
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
                    {suggestions.map((s) => (
                      <ListItem
                        key={s.iso}
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
      {loadStatus === 'failed' && (
        <Typography variant="body2" color="error" sx={{ ml: 1 }}>
          {t.asrRequestFailed}
        </Typography>
      )}
      {listedOptions && !phonetic && (
        <FormControl component="fieldset" variant="standard" sx={{ ml: 1 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>
            {t.asrMethodHint}
          </Typography>
          <FormLabel component="legend">{t.asrMethod}</FormLabel>
          <RadioGroup value={selectedMethod} onChange={handleMethodChange}>
            <FormControlLabel
              value={asrMethodDefaultValue}
              control={<Radio />}
              label={t.asrMethodDefault.replace('{0}', listedOptions.preferred)}
            />
            {listedOptions.others.map((method) => (
              <FormControlLabel
                key={method}
                value={method}
                control={<Radio />}
                label={method}
              />
            ))}
          </RadioGroup>
        </FormControl>
      )}
    </Stack>
  );
};
