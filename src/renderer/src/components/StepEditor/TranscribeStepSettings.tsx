import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type SetStateAction,
} from 'react';
import {
  ArtifactTypeSlug,
  defaultSpellCheckForArtifact,
  resolveStepSpellCheck,
  useArtifactType,
} from '../../crud';
import SelectArtifactType from '../Sheet/SelectArtifactType';
import { ILanguage, Language } from '../../control';
import { JSONParse, isLangSet } from '../../utils';
import { isElectron } from '../../../api-variable';
import { MainAPI } from '@model/main-api';
import {
  Checkbox,
  FormControl,
  FormControlLabel,
  FormLabel,
} from '@mui/material';
import { vProjectSelector } from '../../selector';
import { ITranscriberStrings, IVProjectStrings } from '../../model';

const ipc = window?.api as MainAPI | undefined;
import {
  isValidAsrLanguage,
  isoFromBcp47,
  needsSisterLanguage,
  preferredAsrMethodFromBcp47,
} from '../../business/asr/asrLanguages';
import { AsrSettings } from '../../business/asr/AsrSettings';
import {
  useRecommendAsrLanguage,
  IAsrLanguageSuggestion,
} from '../../business/asr/useRecommendAsrLanguage';
import { AsrTarget } from '../../business/asr/AsrTarget';
import { shallowEqual, useSelector } from 'react-redux';
import { transcriberSelector } from '../../selector';
import {
  orgDefaultAsr,
  orgDefaultLangProps,
  useOrgDefaults,
} from '../../crud/useOrgDefaults';
import {
  buildVernacularAsrState,
  formatStepLanguageField,
  parseStepLanguageField,
  type TranscribeStepSettings as ITranscribeStepSettings,
} from '../../crud/transcribeStepAsrSettings';
import { IAsrState } from '../../business/asr/asrState';
import { getPreferredAsrMethod } from '../../business/asr/asrLanguages';
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

  const asrDefault: IAsrState = useMemo(
    () => ({
      target: AsrTarget.alphabet,
      language: {
        bcp47: 'und',
        languageName: 'English',
        font: 'charissil',
        rtl: false,
        spellCheck: false,
      },
      asrIso: 'eng',
      method: getPreferredAsrMethod('eng'),
      dialect: undefined,
      selectRoman: false,
    }),
    []
  );

  const vernacularAsrSettings = useCallback(
    (settingsJson: string): ITranscribeStepSettings => {
      const settings = JSONParse(settingsJson) as ITranscribeStepSettings;
      const phonetic = settings.phonetic ?? false;
      return {
        ...settings,
        phonetic,
        sisterlanguage:
          settings.sisterlanguage ?? formatStepLanguageField(sisterLanguage),
      };
    },
    [sisterLanguage]
  );

  const syncOrgAsrIfVernacular = useCallback(
    (settingsJson: string) => {
      if (!org) return;
      const settings = JSONParse(settingsJson) as ITranscribeStepSettings;
      if (
        slugFromId(String(settings.artifactTypeId ?? '')) !==
        ArtifactTypeSlug.Vernacular
      ) {
        return;
      }
      const asrState = buildVernacularAsrState(
        vernacularAsrSettings(settingsJson),
        getOrgDefault,
        org,
        asrDefault
      );
      setOrgDefault(orgDefaultAsr, asrState, org);
    },
    [
      org,
      slugFromId,
      getOrgDefault,
      setOrgDefault,
      asrDefault,
      vernacularAsrSettings,
    ]
  );

  const emitSettingsChange = useCallback(
    (settingsJson: string) => {
      onChange(settingsJson);
      syncOrgAsrIfVernacular(settingsJson);
    },
    [onChange, syncOrgAsrIfVernacular]
  );

  const handleSelect = (artifactTypeId: string | null) => {
    const json = JSONParse(toolSettings) as Record<string, unknown>;
    const [, bcp47] = (json?.language as string | undefined)?.split('|') ?? [
      '',
      'und',
    ];
    const spellCheck = defaultSpellCheckForArtifact(
      slugFromId(artifactTypeId),
      isLangSet(bcp47) ? bcp47 : undefined,
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
    emitSettingsChange(JSON.stringify({ ...rest, artifactTypeId }));
  };

  const handleSpellCheckOnlyChange = (spellCheck: boolean) => {
    setLgState((state) => ({ ...state, spellCheck, changed: true }));
    const json = JSONParse(toolSettings) as Record<string, unknown>;
    emitSettingsChange(JSON.stringify({ ...json, spellCheck }));
  };

  const phoneticSetting = useMemo(() => {
    const json = JSONParse(toolSettings || '{}') as Record<string, unknown>;
    return json?.phonetic === true || json?.phonetic === 'true';
  }, [toolSettings]);

  const handleLanguageChange = (val: ILanguage) => {
    if (
      lgState?.bcp47 !== val?.bcp47 ||
      lgState?.font !== val?.font ||
      lgState?.spellCheck !== val?.spellCheck
    ) {
      setLgState((state) => ({ ...state, ...val, changed: true }));
      const json = JSONParse(toolSettings) as Record<string, unknown>;
      emitSettingsChange(
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
    if (org) {
      setOrgDefault(orgDefaultLangProps, val, org);
      syncOrgAsrIfVernacular(toolSettings);
    }
  };

  const currentSlug = useMemo(
    () => slugFromId(lgState.artId),
    [lgState.artId, slugFromId]
  );

  const hasLang = langSlugs.includes(currentSlug);

  const showSpellCheckOnly = !hasLang;

  useEffect(() => {
    if (toolSettings) {
      const json = JSON.parse(toolSettings);
      setInitialValue(json.artifactTypeId);
      const { languageName, bcp47 } = parseStepLanguageField(json?.language);
      const slug = slugFromId(json.artifactTypeId);
      const sisterLang = parseStepLanguageField(json?.sisterlanguage);
      const spellCheck = resolveStepSpellCheck(
        json,
        slug,
        isLangSet(bcp47) ? bcp47 : undefined,
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
      setSisterLanguage((state) => ({
        ...state,
        languageName: sisterLang.languageName,
        bcp47: sisterLang.bcp47,
      }));
    }
    // slugFromId (from useArtifactType) is recreated every render, so listing it
    // here would re-run this initializer on every render and clobber in-progress
    // edits (e.g. the sister language the user just picked, before the change has
    // propagated back through toolSettings). Only re-sync when settings change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolSettings, availSpellLangs]);

  const handleSisterLanguageChange = (val: ILanguage) => {
    const bcp47 = val?.bcp47 ?? 'und';
    // The picker fires onChange once on mount with its initial (current) value.
    // Ignore that echo so opening the picker doesn't re-save the same language.
    if (
      bcp47 === (sisterLanguage?.bcp47 ?? 'und') &&
      (val?.languageName ?? '') === (sisterLanguage?.languageName ?? '')
    ) {
      return;
    }
    if (isLangSet(bcp47) && !isValidAsrLanguage(isoFromBcp47(bcp47))) {
      showMessage(tt.invalidSisterLang);
      setSisterLanguage(emptyLanguage());
      const json = JSONParse(toolSettings) as Record<string, string>;
      emitSettingsChange(
        JSON.stringify({
          ...json,
          sisterlanguage: formatStepLanguageField(emptyLanguage()),
          selectRoman: false,
        })
      );
      return;
    }
    setSisterLanguage(val);
    const json = JSONParse(toolSettings) as Record<string, string>;
    emitSettingsChange(
      JSON.stringify({
        ...json,
        sisterlanguage: formatStepLanguageField(val),
        selectRoman: false,
      })
    );
  };

  useEffect(() => {
    if (!isOpen || currentSlug !== ArtifactTypeSlug.Vernacular) return;
    vernacularPickerInit.current = true;
    setVernacularLanguage(readVernacularFromOrg());
    // readVernacularFromOrg is recreated every render (getOrgDefault is not
    // memoized); depending on it here would re-run this effect on every render,
    // perpetually resetting the picker and discarding the user's change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentSlug, org]);

  const primaryBcp47 = useMemo(() => {
    if (currentSlug === ArtifactTypeSlug.Vernacular)
      return vernacularLanguage?.bcp47 ?? 'und';
    if (hasLang) return lgState.bcp47 ?? 'und';
    return 'und';
  }, [currentSlug, vernacularLanguage?.bcp47, lgState.bcp47, hasLang]);

  useEffect(() => {
    setShowSisterLanguage(needsSisterLanguage(primaryBcp47));
  }, [primaryBcp47]);

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

  const primaryIso = useMemo(() => isoFromBcp47(primaryBcp47), [primaryBcp47]);

  // ASR settings (transcription type + transliterate) apply whenever there is a
  // primary language to transcribe — either directly (primary is a valid ASR
  // language) or via a sister language.
  const showAsrSettings = isLangSet(primaryBcp47);

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
    if (showSisterLanguage && primaryLanguageName && isLangSet(primaryIso)) {
      const cached = readCachedRecommendations(primaryLanguageName);
      if (cached !== undefined) {
        seedSuggestions(cached);
      } else {
        fetchRecommendations(primaryIso, (found) =>
          persistRecommendations(primaryLanguageName, found)
        );
      }
    } else {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSisterLanguage, primaryLanguageName, primaryIso]);

  const sisterSelectRoman = useMemo(() => {
    const json = JSONParse(toolSettings || '{}') as Record<string, unknown>;
    return json?.selectRoman === true || json?.selectRoman === 'true';
  }, [toolSettings]);

  const sisterAsr: IAsrState = useMemo(
    () => ({
      target: phoneticSetting ? AsrTarget.phonetic : AsrTarget.alphabet,
      language: sisterLanguage,
      asrIso: isoFromBcp47(sisterLanguage?.bcp47 ?? 'und'),
      method: preferredAsrMethodFromBcp47(sisterLanguage?.bcp47 ?? 'und'),
      dialect: undefined,
      selectRoman: sisterSelectRoman,
    }),
    [phoneticSetting, sisterLanguage, sisterSelectRoman]
  );

  // Single adapter that maps AsrSettings' IAsrState edits back to the step
  // settings JSON: transcription type (phonetic), sister language, transliterate.
  const setBoxAsr = (action: SetStateAction<IAsrState | undefined>) => {
    const next = typeof action === 'function' ? action(sisterAsr) : action;
    if (!next) return;
    const nextPhonetic = next.target === AsrTarget.phonetic;
    if (nextPhonetic !== phoneticSetting) {
      const json = JSONParse(toolSettings) as Record<string, unknown>;
      // Transliterate only applies to script transcription; clear it for phonetic.
      emitSettingsChange(
        JSON.stringify({
          ...json,
          phonetic: nextPhonetic,
          ...(nextPhonetic ? { selectRoman: false } : {}),
        })
      );
      return;
    }
    const langChanged =
      (next.language?.bcp47 ?? 'und') !== (sisterLanguage?.bcp47 ?? 'und') ||
      (next.language?.languageName ?? '') !==
        (sisterLanguage?.languageName ?? '');
    if (langChanged) {
      handleSisterLanguageChange(next.language);
      return;
    }
    if (Boolean(next.selectRoman) !== sisterSelectRoman) {
      const json = JSONParse(toolSettings) as Record<string, unknown>;
      emitSettingsChange(
        JSON.stringify({ ...json, selectRoman: Boolean(next.selectRoman) })
      );
    }
  };

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
          hideFont
          required={true}
          disabled={false}
          sx={{ ml: 1 }}
        />
      ) : (
        <>
          {hasLang && (
            <Language
              {...lgState}
              onChange={handleLanguageChange}
              hideFont
              required={false}
              disabled={false}
              sx={{ ml: 1 }}
            />
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
        </>
      )}
      {showAsrSettings && (
        <FormControl
          component="fieldset"
          sx={{
            border: '1px solid grey',
            ml: 1,
            mr: 1,
            px: 2,
            mt: 1,
            display: 'block',
          }}
        >
          <FormLabel component="legend" sx={{ color: 'secondary.main' }}>
            {tt.aiAutomaticTranscription}
          </FormLabel>
          <AsrSettings
            asr={sisterAsr}
            setAsr={setBoxAsr}
            vernacularBcp47={primaryBcp47}
            recommendKey={primaryLanguageName}
            suggestions={suggestions}
            loading={loading}
            error={error}
          />
        </FormControl>
      )}
    </>
  );
};
