import { useEffect, useMemo, useState } from 'react';
import { Stack, Typography } from '@mui/material';
import { shallowEqual, useSelector } from 'react-redux';
import { ArtifactTypeSlug, useArtifactType } from '../../crud';
import {
  formatStepLanguageField,
  parseStepLanguageField,
} from '../../crud/transcribeStepAsrSettings';
import { Language, ILanguage } from '../../control';
import { stepEditorSelector } from '../../selector';
import { IStepEditorStrings, OrgWorkflowStepD } from '../../model';
import { useOrbitData } from '../../hoc/useOrbitData';
import { isDuplicatePhraseBtLanguage } from './isDuplicatePhraseBtLanguage';

interface IProps {
  toolSettings: string;
  onChange: (toolSettings: string) => void;
  stepId?: string;
  /** Current team — duplicate language check stays within this org. */
  organizationId?: string;
}

const emptyLanguage = (): ILanguage => ({
  bcp47: 'und',
  languageName: '',
  font: '',
  rtl: false,
  spellCheck: false,
});

export const PhraseBackTranslateStepSettings = ({
  toolSettings,
  onChange,
  stepId,
  organizationId,
}: IProps) => {
  const se: IStepEditorStrings = useSelector(stepEditorSelector, shallowEqual);
  const { slugFromId } = useArtifactType();
  const orgSteps = useOrbitData<OrgWorkflowStepD[]>('orgworkflowstep');
  // Artifact type is fixed by the workflow step preset (Phrase BT vs Retell BT),
  // not chosen in this dialog — TT-7555. Stored as a slug; converted to an id
  // only at the DB boundary.
  const [artifactTypeId, setArtifactTypeId] = useState<string>(
    ArtifactTypeSlug.PhraseBackTranslation
  );
  const [lgState, setLgState] = useState<ILanguage>(emptyLanguage());
  const [error, setError] = useState('');

  useEffect(() => {
    if (!toolSettings) return;
    try {
      const json = JSON.parse(toolSettings) as Record<string, unknown>;
      if (json.artifactTypeId) {
        // Tolerates settings that still hold an id from before the slug switch.
        setArtifactTypeId(slugFromId(String(json.artifactTypeId)));
      }
      const parsed = parseStepLanguageField(json.language);
      setLgState({
        ...emptyLanguage(),
        languageName: parsed.languageName,
        bcp47: parsed.bcp47,
      });
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolSettings]);

  const teamSteps = useMemo(() => orgSteps, [orgSteps]);

  const emit = (nextArt: string, nextLang: ILanguage) => {
    const bcp47 = nextLang.bcp47 || 'und';
    const payload = {
      artifactTypeId: nextArt,
      language: formatStepLanguageField(nextLang),
    };
    if (bcp47 === 'und' || !nextLang.languageName) {
      setError(se.languageRequired);
      onChange(JSON.stringify(payload));
      return;
    }
    if (
      isDuplicatePhraseBtLanguage(teamSteps, {
        stepId,
        artifactTypeId: nextArt,
        languageBcp47: bcp47,
        organizationId,
        slugFromId,
      })
    ) {
      setError(se.duplicatePhraseBtLanguage);
      return;
    }
    setError('');
    onChange(JSON.stringify(payload));
  };

  // Language fires onChange once on mount with its current value. Ignore that
  // echo (and any later no-op sync) so reopening saved settings cannot rewrite
  // toolSettings and fight the toolSettings→lgState effect (TT-7553).
  const handleLanguageChange = (val: ILanguage) => {
    if (
      lgState.bcp47 === val.bcp47 &&
      lgState.languageName === val.languageName
    ) {
      return;
    }
    setLgState(val);
    emit(artifactTypeId, val);
  };

  return (
    <Stack spacing={2} sx={{ minWidth: 280 }}>
      <Language
        {...lgState}
        onChange={handleLanguageChange}
        hideFont
        required
      />
      {error ? (
        <Typography color="error" variant="body2">
          {error}
        </Typography>
      ) : null}
    </Stack>
  );
};

export default PhraseBackTranslateStepSettings;
