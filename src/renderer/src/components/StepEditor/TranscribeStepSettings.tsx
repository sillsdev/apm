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
import { shallowEqual, useSelector } from 'react-redux';
import { transcriberSelector, vProjectSelector } from '../../selector';
import { ITranscriberStrings, IVProjectStrings } from '../../model';

const ipc = window?.api as MainAPI | undefined;
import {
  asrLanguageFilter,
  isValidAsrLanguage,
  isoFromBcp47,
} from '../../business/asr/asrLanguages';
import { Typography } from '@mui/material';
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
  }, [isOpen, currentSlug, readVernacularFromOrg]);

  useEffect(() => {
    const primaryBcp47 =
      currentSlug === ArtifactTypeSlug.Vernacular
        ? (vernacularLanguage?.bcp47 ?? 'und')
        : hasLang
          ? (lgState.bcp47 ?? 'und')
          : 'und';
    setShowSisterLanguage(primaryNeedsSisterLanguage(primaryBcp47));
  }, [currentSlug, vernacularLanguage?.bcp47, lgState.bcp47, hasLang]);

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

  const sisterLanguagePicker = showSisterLanguage ? (
    <>
      <Typography variant="body2" sx={{ ml: 1 }}>
        {tt.sisterLang}
      </Typography>
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
