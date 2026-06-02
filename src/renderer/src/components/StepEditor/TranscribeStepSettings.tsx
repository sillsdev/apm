import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArtifactTypeSlug,
  defaultSpellCheckForArtifact,
  resolveStepSpellCheck,
  useArtifactType,
} from '../../crud';
import SelectArtifactType from '../Sheet/SelectArtifactType';
import { ILanguage, Language } from '../../control';
import { JSONParse } from '../../utils';
import { isElectron } from '../../../api-variable';
import { MainAPI } from '@model/main-api';
import { Checkbox, FormControlLabel } from '@mui/material';
import { vProjectSelector } from '../../selector';
import { ITranscriberStrings, IVProjectStrings } from '../../model';

const ipc = window?.api as MainAPI | undefined;
import {
  asrLanguageFilter,
  isValidAsrLanguage,
  isoFromBcp47,
} from '../../business/asr/asrLanguages';
import {
  useRecommendAsrLanguage,
  IAsrLanguageSuggestion,
} from '../../business/asr/useRecommendAsrLanguage';
import {
  Typography,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
} from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { transcriberSelector } from '../../selector';
import { orgDefaultLangProps, useOrgDefaults } from '../../crud/useOrgDefaults';
import {
  formatStepLanguageField,
  parseStepLanguageField,
} from '../../crud/transcribeStepAsrSettings';
import { useSnackBar } from '../../hoc/SnackBar';

interface LangState {
  artId: string;
  bcp47: string;
  languageName: string;
  font: string;
  rtl: boolean;
  spellCheck: boolean;
  changed: boolean;
}
const emptyLanguage = (): ILanguage => ({
  bcp47: 'und',
  languageName: '',
  font: '',
  rtl: false,
  spellCheck: false,
});
const initLang = {
  ...emptyLanguage(),
  artId: '',
  changed: false,
};

interface IProps {
  org: string;
  isOpen: boolean;
  toolSettings: string;
  onChange: (toolSettings: string) => void;
}

export const TranscribeStepSettings = ({
  org,
  isOpen,
  toolSettings,
  onChange,
}: IProps) => {
  // const classes = useStyles();
  const artifacts = [
    ArtifactTypeSlug.Vernacular,
    ArtifactTypeSlug.WholeBackTranslation,
    ArtifactTypeSlug.PhraseBackTranslation,
    ArtifactTypeSlug.CarefulSpeech,
    ArtifactTypeSlug.QandA,
    ArtifactTypeSlug.Retell,
  ];
  const [initialValue, setInitialValue] = useState<string | null>(null);
  const [lgState, setLgState] = useState<LangState>({ ...initLang });
  const [availSpellLangs, setAvailSpellLangs] = useState<string[]>([]);
  const { slugFromId } = useArtifactType();
  const t: IVProjectStrings = useSelector(vProjectSelector, shallowEqual);
  const tt: ITranscriberStrings = useSelector(
    transcriberSelector,
    shallowEqual
  );
  useEffect(() => {
    if (isElectron) {
      ipc
        ?.availSpellLangs()
        .then((list: string[]) => setAvailSpellLangs(list ?? []))
        .catch(() => setAvailSpellLangs([]));
    }
  }, []);

  const [showSisterLanguage, setShowSisterLanguage] = useState(false);
  const [vernacularLanguage, setVernacularLanguage] =
    useState<ILanguage>(emptyLanguage);
  const vernacularPickerInit = useRef(true);
  const [sisterLanguage, setSisterLanguage] =
    useState<ILanguage>(emptyLanguage);
  const { getOrgDefault, setOrgDefault } = useOrgDefaults();
  const { showMessage } = useSnackBar();
  const {
    suggestions,
    loading,
    attempted,
    error,
    fetchRecommendations,
    seedSuggestions,
    reset,
  } = useRecommendAsrLanguage();
  const toolSettingsRef = useRef(toolSettings);
  toolSettingsRef.current = toolSettings;
  const langSlugs = [
    ArtifactTypeSlug.WholeBackTranslation,
    ArtifactTypeSlug.PhraseBackTranslation,
    ArtifactTypeSlug.CarefulSpeech,
  ];
  const readVernacularFromOrg = useCallback(() => {
    if (!org) return emptyLanguage();
    return (
      (getOrgDefault(orgDefaultLangProps, org) as ILanguage | undefined) ??
      emptyLanguage()
    );
  }, [getOrgDefault, org]);

  const primaryNeedsSisterLanguage = (primaryBcp47: string) => {
    if (!primaryBcp47 || primaryBcp47 === 'und') return false;
    const iso = isoFromBcp47(primaryBcp47);
    if (!iso || iso === 'und') return true;
    return !isValidAsrLanguage(iso);
  };

  const handleSelect = (artifactTypeId: string | null) => {
    const json = JSONParse(toolSettings) as Record<string, unknown>;
    const [, bcp47] = (json?.language as string | undefined)?.split('|') ?? [
      '',
      'und',
    ];
    const spellCheck = defaultSpellCheckForArtifact(
      slugFromId(artifactTypeId),
      bcp47 !== 'und' ? bcp47 : undefined,
      availSpellLangs
    );
    setLgState((state) => ({
      ...state,
      artId: artifactTypeId ?? '',
      spellCheck,
      changed: false,
    }));
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { spellCheck: _omit, ...rest } = json;
    onChange(JSON.stringify({ ...rest, artifactTypeId }));
  };

  const handleSpellCheckOnlyChange = (spellCheck: boolean) => {
    setLgState((state) => ({ ...state, spellCheck, changed: true }));
    const json = JSONParse(toolSettings) as Record<string, unknown>;
    onChange(JSON.stringify({ ...json, spellCheck }));
  };

  const handleLanguageChange = (val: ILanguage) => {
    if (
      lgState?.bcp47 !== val?.bcp47 ||
      lgState?.font !== val?.font ||
      lgState?.spellCheck !== val?.spellCheck
    ) {
      setLgState((state) => ({ ...state, ...val, changed: true }));
      const json = JSONParse(toolSettings) as Record<string, unknown>;
      onChange(
        JSON.stringify({
          ...json,
          language: formatStepLanguageField(val),
          font: val.font,
          rtl: val.rtl,
          spellCheck: val.spellCheck,
        })
      );
    }
  };

  const handleVernacularLanguageChange = (val: ILanguage) => {
    if (vernacularPickerInit.current) {
      vernacularPickerInit.current = false;
      return;
    }
    setVernacularLanguage(val);
    if (org) setOrgDefault(orgDefaultLangProps, val, org);
  };

  const artifactSlugCurrent = useMemo(
    () => slugFromId(lgState.artId || null),
    [lgState.artId, slugFromId]
  );

  const hasLang = langSlugs.includes(artifactSlugCurrent);

  const showSpellCheckOnly = !hasLang;

  useEffect(() => {
    if (toolSettings) {
      const json = JSON.parse(toolSettings);
      setInitialValue(json.artifactTypeId);
      const [languageName, bcp47] = json?.language?.split('|') ?? ['', 'und'];
      const slug = slugFromId(json.artifactTypeId);
      const spellCheck = resolveStepSpellCheck(
        json,
        slug,
        bcp47 !== 'und' ? bcp47 : undefined,
        availSpellLangs
      );
      setLgState((state) => ({
        ...state,
        artId: json.artifactTypeId,
        languageName,
        bcp47,
        font: json.font,
        rtl: json.rtl,
        spellCheck,
        changed: false,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolSettings, availSpellLangs]);
  const handleSisterLanguageChange = (val: ILanguage) => {
    const bcp47 = val?.bcp47 ?? 'und';
    if (bcp47 !== 'und') {
      const valid = isValidAsrLanguage(isoFromBcp47(bcp47));
      if (!valid) {
        showMessage(tt.invalidSisterLang);
        setSisterLanguage({
          bcp47: 'und',
          languageName: '',
          font: '',
          rtl: false,
          spellCheck: false,
        });
        const json = JSONParse(toolSettings) as Record<string, string>;
        onChange(
          JSON.stringify({
            ...json,
            sisterlanguage: formatStepLanguageField(emptyLanguage()),
          })
        );
        return;
      }
    }
    setSisterLanguage(val);
    const json = JSONParse(toolSettings) as Record<string, string>;
    onChange(
      JSON.stringify({
        ...json,
        sisterlanguage: formatStepLanguageField(val),
      })
    );
  };

  const currentSlug = useMemo(
    () => slugFromId(lgState.artId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lgState.artId]
  );

  useEffect(() => {
    if (!isOpen || currentSlug !== ArtifactTypeSlug.Vernacular) return;
    vernacularPickerInit.current = true;
    setVernacularLanguage(readVernacularFromOrg());
    // readVernacularFromOrg is recreated every render (getOrgDefault is not
    // memoized); depending on it here would re-run this effect on every render,
    // perpetually resetting the picker and discarding the user's change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentSlug, org]);

  useEffect(() => {
    const primaryBcp47 =
      currentSlug === ArtifactTypeSlug.Vernacular
        ? (vernacularLanguage?.bcp47 ?? 'und')
        : hasLang
          ? (lgState.bcp47 ?? 'und')
          : 'und';
    setShowSisterLanguage(primaryNeedsSisterLanguage(primaryBcp47));
  }, [currentSlug, vernacularLanguage?.bcp47, lgState.bcp47, hasLang]);

  const primaryLanguageName = useMemo(() => {
    if (currentSlug === ArtifactTypeSlug.Vernacular)
      return vernacularLanguage?.languageName ?? '';
    if (hasLang) return lgState.languageName ?? '';
    return '';
  }, [
    currentSlug,
    vernacularLanguage?.languageName,
    lgState.languageName,
    hasLang,
  ]);

  const readCachedRecommendations = (
    lang: string
  ): IAsrLanguageSuggestion[] | undefined => {
    const json = JSONParse(toolSettings) as Record<string, string>;
    if (!json?.sisterRecommendations) return undefined;
    try {
      const cached = JSON.parse(json.sisterRecommendations) as {
        forLanguage?: string;
        suggestions?: IAsrLanguageSuggestion[];
      };
      if (cached?.forLanguage !== lang || !Array.isArray(cached?.suggestions))
        return undefined;
      return cached.suggestions.map((s) => ({ ...s, raw: s }));
    } catch {
      return undefined;
    }
  };

  const persistRecommendations = (
    lang: string,
    found: IAsrLanguageSuggestion[]
  ) => {
    const json = JSONParse(toolSettingsRef.current) as Record<string, string>;
    const lean = found.map((s) => ({
      languageName: s.languageName,
      iso: s.iso,
      methods: s.methods,
      reason: s.reason,
    }));
    onChange(
      JSON.stringify({
        ...json,
        sisterRecommendations: JSON.stringify({
          forLanguage: lang,
          suggestions: lean,
        }),
      })
    );
  };

  useEffect(() => {
    if (showSisterLanguage && primaryLanguageName) {
      const cached = readCachedRecommendations(primaryLanguageName);
      if (cached !== undefined) {
        seedSuggestions(cached);
      } else {
        fetchRecommendations(primaryLanguageName, (found) =>
          persistRecommendations(primaryLanguageName, found)
        );
      }
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSisterLanguage, primaryLanguageName]);

  const saveSisterLanguage = (val: ILanguage) => {
    setSisterLanguage(val);
    const json = JSONParse(toolSettings) as Record<string, string>;
    onChange(
      JSON.stringify({
        ...json,
        sisterlanguage: formatStepLanguageField(val),
      })
    );
  };

  const suggestionToLanguage = (s: IAsrLanguageSuggestion): ILanguage => ({
    bcp47: s.iso || 'und',
    languageName: s.languageName,
    font: '',
    rtl: false,
    spellCheck: false,
  });

  const handleSisterSuggestion = (event: SelectChangeEvent) => {
    const idx = Number(event.target.value);
    const s = suggestions[idx];
    if (s) saveSisterLanguage(suggestionToLanguage(s));
  };

  const selectedSuggestionIndex = suggestions.findIndex(
    (s) =>
      (s.iso && s.iso === sisterLanguage.bcp47) ||
      (s.languageName && s.languageName === sisterLanguage.languageName)
  );

  useEffect(() => {
    if (!toolSettings) return;
    const json = JSON.parse(toolSettings) as Record<string, string>;
    setInitialValue(json.artifactTypeId);
    const { languageName, bcp47 } = parseStepLanguageField(json?.language);
    const sisterLang = parseStepLanguageField(json?.sisterlanguage);
    setLgState((state) => ({
      ...state,
      artId: json.artifactTypeId,
      languageName: languageName,
      bcp47: bcp47 ?? 'und',
      font: json.font ?? '',
      rtl: json.rtl === 'true',
    }));
    setSisterLanguage((state) => ({
      ...state,
      languageName: sisterLang.languageName,
      bcp47: sisterLang.bcp47,
    }));
  }, [toolSettings]);

  const manualSisterPicker = (
    <Language
      key={`sister-${sisterLanguage?.bcp47 ?? 'und'}`}
      {...sisterLanguage}
      onChange={handleSisterLanguageChange}
      filter={asrLanguageFilter}
      hideSpelling
      hideFont
      required={false}
      disabled={false}
      sx={{ ml: 1 }}
    />
  );

  const sisterLanguagePicker = showSisterLanguage ? (
    <>
      <Typography variant="body2" sx={{ ml: 1 }}>
        {tt.sisterLang}
      </Typography>
      {loading ? (
        <Stack
          direction="row"
          spacing={1}
          alignItems="center"
          sx={{ ml: 1, my: 1 }}
        >
          <CircularProgress size={16} />
          <Typography variant="body2">{tt.findingSisterLang}</Typography>
        </Stack>
      ) : suggestions.length > 0 ? (
        <FormControl size="small" sx={{ ml: 1, minWidth: 220 }}>
          <InputLabel id="sister-lang-label">{tt.chooseSisterLang}</InputLabel>
          <Select
            labelId="sister-lang-label"
            label={tt.chooseSisterLang}
            value={
              selectedSuggestionIndex >= 0
                ? String(selectedSuggestionIndex)
                : ''
            }
            onChange={handleSisterSuggestion}
          >
            {suggestions.map((s, i) => (
              <MenuItem
                key={`sister-suggestion-${i}`}
                value={String(i)}
                title={s.reason}
              >
                {s.languageName || s.iso}
                {s.iso ? ` (${s.iso})` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      ) : attempted ? (
        <>
          {error && (
            <Typography variant="body2" color="error" sx={{ ml: 1 }}>
              {error}
            </Typography>
          )}
          {manualSisterPicker}
        </>
      ) : null}
    </>
  ) : null;

  return (
    <>
      <SelectArtifactType
        onTypeChange={handleSelect}
        limit={artifacts}
        initialValue={initialValue}
      />
      {currentSlug === ArtifactTypeSlug.Vernacular ? (
        <Language
          key={`vernacular-${vernacularLanguage?.bcp47 ?? 'und'}`}
          {...vernacularLanguage}
          onChange={handleVernacularLanguageChange}
          required={true}
          disabled={false}
          sx={{ ml: 1 }}
        />
      ) : (
        hasLang && (
          <Language
            {...lgState}
            onChange={handleLanguageChange}
            hideFont
            required={false}
            disabled={false}
            sx={{ ml: 1 }}
          />
        )
      )}
      {showSpellCheckOnly && (
        <FormControlLabel
          sx={{ ml: 1, display: 'block' }}
          control={
            <Checkbox
              id="transcribe-step-spellCheck"
              checked={lgState.spellCheck}
              onChange={(e) => handleSpellCheckOnlyChange(e.target.checked)}
            />
          }
          label={t.spellCheck}
        />
      )}
      {sisterLanguagePicker}
    </>
  );
};
