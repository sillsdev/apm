import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArtifactTypeSlug,
  defaultSpellCheckForArtifact,
  resolveStepSpellCheck,
  useArtifactType,
} from '../../crud';
import SelectArtifactType from '../Sheet/SelectArtifactType';
import { ILanguage, Language } from '../../control';
import { useGlobal } from '../../context/useGlobal';
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
import { isoFromBcp47 } from '../../business/asr/asrLanguages';
import { AsrSettings } from '../../business/asr/AsrSettings';
import {
  useRecommendAsrLanguage,
  IAsrLanguageSuggestion,
} from '../../business/asr/useRecommendAsrLanguage';
import { shallowEqual, useSelector } from 'react-redux';
import { transcriberSelector } from '../../selector';
import { orgDefaultLangProps, useOrgDefaults } from '../../crud/useOrgDefaults';
import {
  artifactUsesOrgVernacularLanguage,
  formatStepLanguageField,
  parseStepLanguageField,
  stepEditorShowsLanguage,
  stepLanguageArtifactSlugs,
} from '../../crud/transcribeStepAsrSettings';
import { useTranscribeStepAsr } from './useTranscribeStepAsr';
import { useSetTeamLanguage } from '../../crud/useSetTeamLanguage';

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

  const [vernacularLanguage, setVernacularLanguage] =
    useState<ILanguage>(emptyLanguage);
  const vernacularPickerInit = useRef(true);
  const { getOrgDefault } = useOrgDefaults();
  const setTeamLanguage = useSetTeamLanguage();
  const [offlineOnly] = useGlobal('offlineOnly'); // constant for the session
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
  const readVernacularFromOrg = useCallback(() => {
    if (!org) return emptyLanguage();
    return (
      (getOrgDefault(orgDefaultLangProps, org) as ILanguage | undefined) ??
      emptyLanguage()
    );
  }, [getOrgDefault, org]);

  const currentSlug = useMemo(
    () => slugFromId(lgState.artId),
    [lgState.artId, slugFromId]
  );
  const hasLang = stepLanguageArtifactSlugs.includes(currentSlug);
  const showSpellCheckOnly = !hasLang;
  const primaryBcp47 = useMemo(() => {
    if (artifactUsesOrgVernacularLanguage(currentSlug as ArtifactTypeSlug))
      return vernacularLanguage?.bcp47 ?? 'und';
    if (hasLang) return lgState.bcp47 ?? 'und';
    return 'und';
  }, [currentSlug, vernacularLanguage?.bcp47, lgState.bcp47, hasLang]);

  const { asr, setAsr, showSisterLanguage } = useTranscribeStepAsr({
    org,
    toolSettings,
    onChange,
    primaryBcp47,
    currentSlug,
    vernacularLanguage,
  });

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
    if (org) {
      setTeamLanguage(val, org);
    }
  };

  useEffect(() => {
    if (!toolSettings) return;
    const json = JSON.parse(toolSettings);
    setInitialValue(json.artifactTypeId);
    const { languageName, bcp47 } = parseStepLanguageField(json?.language);
    const slug = slugFromId(json.artifactTypeId);
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
    // slugFromId (from useArtifactType) is recreated every render, so listing it
    // here would re-run this initializer on every render and clobber in-progress
    // edits before the change has propagated back through toolSettings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolSettings, availSpellLangs]);

  useEffect(() => {
    if (
      !isOpen ||
      !artifactUsesOrgVernacularLanguage(currentSlug as ArtifactTypeSlug)
    )
      return;
    vernacularPickerInit.current = currentSlug === ArtifactTypeSlug.Vernacular;
    setVernacularLanguage(readVernacularFromOrg());
    // readVernacularFromOrg is recreated every render (getOrgDefault is not
    // memoized); depending on it here would re-run this effect on every render,
    // perpetually resetting the picker and discarding the user's change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentSlug, org]);

  const primaryLanguageName = useMemo(() => {
    if (artifactUsesOrgVernacularLanguage(currentSlug as ArtifactTypeSlug))
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

  // ASR settings go with the language they transcribe, and need the speech
  // service, so a Work Alone Offline session hides them.
  const showAsrSettings =
    stepEditorShowsLanguage(currentSlug) &&
    isLangSet(primaryBcp47) &&
    !offlineOnly;

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
    if (
      showAsrSettings &&
      showSisterLanguage &&
      primaryLanguageName &&
      isLangSet(primaryIso)
    ) {
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
  }, [showAsrSettings, showSisterLanguage, primaryLanguageName, primaryIso]);

  return (
    <>
      <SelectArtifactType
        onTypeChange={handleSelect}
        limit={artifacts}
        initialValue={initialValue}
      />
      {currentSlug === ArtifactTypeSlug.Vernacular ? (
        <>
          <Language
            key={`vernacular-${vernacularLanguage?.bcp47 ?? 'und'}`}
            {...vernacularLanguage}
            onChange={handleVernacularLanguageChange}
            hideFont
            hideSpelling
            required={true}
            disabled={false}
            sx={{ ml: 1 }}
          />
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
        </>
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
            asr={asr}
            setAsr={setAsr}
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
