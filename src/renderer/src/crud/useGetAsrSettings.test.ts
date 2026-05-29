import { ArtifactTypeSlug } from './artifactTypeSlug';
import { ToolSlug } from './toolSlug';
import {
  artifactTypeSlugFromSettings,
  artifactUsesOrgVernacularLanguage,
  buildVernacularAsrState,
  buildWorkflowAsrStateFromSettings,
  formatStepLanguageField,
  hasTranscribeStepLanguageSettings,
  parseStepLanguageField,
  sisterBcpFromSettings,
} from './transcribeStepAsrSettings';
import { AsrTarget } from '../business/asr/AsrTarget';
const orgLangPropsKey = 'langProps';

const asrDefault = {
  target: AsrTarget.alphabet,
  language: {
    bcp47: 'und',
    languageName: 'English',
    font: 'charissil',
    rtl: false,
    spellCheck: false,
  },
  mmsIso: 'eng',
  method: 'whisper',
  dialect: undefined,
  selectRoman: false,
};

describe('parseStepLanguageField', () => {
  it('parses languageName|bcp47', () => {
    expect(parseStepLanguageField('English|en')).toEqual({
      languageName: 'English',
      bcp47: 'en',
    });
  });
});

describe('formatStepLanguageField', () => {
  it('writes languageName|bcp47', () => {
    expect(
      formatStepLanguageField({ languageName: 'French', bcp47: 'fr' })
    ).toBe('French|fr');
  });
});

describe('sisterBcpFromSettings', () => {
  it('reads bcp47 from sisterlanguage field', () => {
    expect(
      sisterBcpFromSettings({
        sisterlanguage: formatStepLanguageField({
          languageName: 'French',
          bcp47: 'fr',
        }),
      })
    ).toBe('fr');
  });
});

describe('artifactUsesOrgVernacularLanguage', () => {
  it('includes vernacular, qanda, and retell', () => {
    expect(artifactUsesOrgVernacularLanguage(ArtifactTypeSlug.Vernacular)).toBe(
      true
    );
    expect(artifactUsesOrgVernacularLanguage(ArtifactTypeSlug.QandA)).toBe(
      true
    );
    expect(artifactUsesOrgVernacularLanguage(ArtifactTypeSlug.Retell)).toBe(
      true
    );
    expect(
      artifactUsesOrgVernacularLanguage(ArtifactTypeSlug.PhraseBackTranslation)
    ).toBe(false);
  });
});

describe('artifactTypeSlugFromSettings', () => {
  // slugFromId resolves remote ids internally, so '99' maps straight to PBT.
  const slugFromId = (id: string) =>
    id === '99'
      ? ArtifactTypeSlug.PhraseBackTranslation
      : ArtifactTypeSlug.Vernacular;

  it('resolves phrase back translation slug when settings store remote id', () => {
    const slug = artifactTypeSlugFromSettings(
      {
        artifactTypeId: '99',
        language: 'English|en',
      },
      slugFromId
    );
    expect(slug).toBe(ArtifactTypeSlug.PhraseBackTranslation);
  });
});

describe('hasTranscribeStepLanguageSettings', () => {
  const slugFromId = (id: string) =>
    id === '99'
      ? ArtifactTypeSlug.PhraseBackTranslation
      : ArtifactTypeSlug.Vernacular;
  const getOrgDefault = (label: string) =>
    label === orgLangPropsKey
      ? { bcp47: 'und', languageName: '', font: '', rtl: false }
      : undefined;

  it('returns true for PBT when language is set in step settings', () => {
    expect(
      hasTranscribeStepLanguageSettings(
        ToolSlug.Transcribe,
        {
          artifactTypeId: '99',
          language: 'English|en',
        },
        slugFromId,
        getOrgDefault,
        'org-1'
      )
    ).toBe(true);
  });

  it('returns true for Q&A when org vernacular is set', () => {
    const slugFromId = (id: string) =>
      id === '99' ? ArtifactTypeSlug.QandA : ArtifactTypeSlug.Vernacular;
    const getOrgDefault = (label: string) =>
      label === orgLangPropsKey
        ? { bcp47: 'en', languageName: 'English', font: '', rtl: false }
        : undefined;

    expect(
      hasTranscribeStepLanguageSettings(
        ToolSlug.Transcribe,
        { artifactTypeId: '99' },
        slugFromId,
        getOrgDefault,
        'org-1'
      )
    ).toBe(true);
  });

  it('returns false for PBT when only artifactTypeId is set', () => {
    expect(
      hasTranscribeStepLanguageSettings(
        ToolSlug.Transcribe,
        { artifactTypeId: '99' },
        slugFromId,
        getOrgDefault,
        'org-1'
      )
    ).toBe(false);
  });
});

describe('buildWorkflowAsrStateFromSettings', () => {
  const slugFromId = (id: string) =>
    id === '99'
      ? ArtifactTypeSlug.PhraseBackTranslation
      : ArtifactTypeSlug.Vernacular;
  const getOrgDefault = () => ({
    bcp47: 'und',
    languageName: '',
    font: '',
    rtl: false,
  });

  it('uses step language for PBT when artifactTypeId is a remote id', () => {
    const state = buildWorkflowAsrStateFromSettings(
      {
        artifactTypeId: '99',
        language: 'English|en',
      },
      slugFromId,
      getOrgDefault,
      'org-1',
      asrDefault
    );
    expect(state.mmsIso).toBe('eng');
    expect(state.mmsIso).not.toBe('und');
  });

  it('uses sister language when primary is not ASR-supported', () => {
    const state = buildWorkflowAsrStateFromSettings(
      {
        artifactTypeId: '99',
        language: 'Klingon|tlh',
        sisterlanguage: 'English|en',
      },
      slugFromId,
      getOrgDefault,
      'org-1',
      asrDefault
    );
    expect(state.mmsIso).toBe('eng');
    expect(state.language.languageName).toBe('English');
    expect(state.language.bcp47).toBe('en');
  });
});

describe('buildVernacularAsrState', () => {
  const getOrgDefault = (label: string) =>
    label === orgLangPropsKey
      ? { bcp47: 'tlh', languageName: 'Klingon', font: '', rtl: false }
      : undefined;

  it('uses sister languageName from sisterlanguage field', () => {
    const state = buildVernacularAsrState(
      {
        sisterlanguage: formatStepLanguageField({
          languageName: 'English',
          bcp47: 'en',
        }),
      },
      getOrgDefault,
      'org-1',
      asrDefault
    );
    expect(state.mmsIso).toBe('eng');
    expect(state.language.languageName).toBe('English');
  });
});
