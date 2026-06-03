import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArtifactTypeSlug,
  defaultSpellCheckForArtifact,
  remoteIdGuid,
  resolveStepSpellCheck,
  useArtifactType,
} from '../../crud';
import SelectArtifactType from '../Sheet/SelectArtifactType';
import { ILanguage, Language } from '../../control';
import { useGlobal } from '../../context/useGlobal';
import { RecordKeyMap } from '@orbit/records';
import { JSONParse } from '../../utils';
import { isElectron } from '../../../api-variable';
import { MainAPI } from '@model/main-api';
import { Checkbox, FormControlLabel } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { vProjectSelector } from '../../selector';
import { IVProjectStrings } from '../../model';

const ipc = window?.api as MainAPI | undefined;

interface LangState {
  artId: string;
  bcp47: string;
  languageName: string;
  font: string;
  rtl: boolean;
  spellCheck: boolean;
  changed: boolean;
}

const initLang = {
  artId: '',
  bcp47: 'und',
  languageName: '',
  font: '',
  rtl: false,
  spellCheck: false,
  changed: false,
};

interface IProps {
  toolSettings: string;
  onChange: (toolSettings: string) => void;
}

export const TranscribeStepSettings = ({ toolSettings, onChange }: IProps) => {
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
  const [memory] = useGlobal('memory');
  const t: IVProjectStrings = useSelector(vProjectSelector, shallowEqual);

  useEffect(() => {
    if (isElectron) {
      ipc
        ?.availSpellLangs()
        .then((list: string[]) => setAvailSpellLangs(list ?? []))
        .catch(() => setAvailSpellLangs([]));
    }
  }, []);

  const artifactSlug = useCallback(
    (artifactTypeId: string | null | undefined) => {
      if (!artifactTypeId) return ArtifactTypeSlug.Vernacular;
      const id =
        remoteIdGuid(
          'artifacttype',
          artifactTypeId,
          memory?.keyMap as RecordKeyMap
        ) ?? artifactTypeId;
      return slugFromId(id) as ArtifactTypeSlug;
    },
    [memory?.keyMap, slugFromId]
  );

  const handleSelect = (artifactTypeId: string | null) => {
    const json = JSONParse(toolSettings) as Record<string, unknown>;
    const [, bcp47] = (json?.language as string | undefined)?.split('|') ?? [
      '',
      'und',
    ];
    const spellCheck = defaultSpellCheckForArtifact(
      artifactSlug(artifactTypeId),
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
          language: `${val?.languageName}|${val?.bcp47 ?? 'und'}`,
          font: val.font,
          rtl: val.rtl,
          spellCheck: val.spellCheck,
        })
      );
    }
  };

  const langSlugs = [
    ArtifactTypeSlug.WholeBackTranslation,
    ArtifactTypeSlug.PhraseBackTranslation,
    ArtifactTypeSlug.CarefulSpeech,
  ];

  const artifactSlugCurrent = useMemo(
    () => artifactSlug(lgState.artId || null),
    [lgState.artId, artifactSlug]
  );

  const hasLang = langSlugs.includes(artifactSlugCurrent);

  const showSpellCheckOnly = !hasLang;

  useEffect(() => {
    if (toolSettings) {
      const json = JSON.parse(toolSettings);
      setInitialValue(json.artifactTypeId);
      const [languageName, bcp47] = json?.language?.split('|') ?? ['', 'und'];
      const slug = artifactSlug(json.artifactTypeId);
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

  return (
    <>
      <SelectArtifactType
        onTypeChange={handleSelect}
        limit={artifacts}
        initialValue={initialValue}
      />
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
  );
};
