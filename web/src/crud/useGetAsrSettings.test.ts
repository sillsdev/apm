jest.mock('../utils', () => ({
  useJsonParams: () => ({
    getParam: jest.fn(),
    setParam: jest.fn(),
  }),
}));

jest.mock('../utils/axios', () => ({
  axiosGet: jest.fn(async (api: string) => {
    if (String(api).endsWith('/tlh')) {
      throw Object.assign(new Error('not found'), {
        response: { status: 404 },
      });
    }
    return ['whisper'];
  }),
}));

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
  readSisterRecommendations,
  stepSettingsFromAsrState,
  stepSisterRecommendationKey,
  withSisterRecommendations,
} from './transcribeStepAsrSettings';
import { AsrTarget } from '../business/asr/AsrTarget';
import { orgDefaultAsr, orgDefaultLangProps } from './useOrgDefaults';

const asrDefault = {
  target: AsrTarget.alphabet,
  language: {
    bcp47: 'und',
    languageName: 'English',
    font: 'charissil',
    rtl: false,
    spellCheck: false,
  },
  asrIso: 'eng',
  asrMethod: 'whisper',
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

  it('reads an ILanguage object without producing "[object Object]"', () => {
    expect(
      parseStepLanguageField({
        languageName: 'English',
        bcp47: 'en',
        font: 'charissil',
        rtl: false,
      })
    ).toEqual({ languageName: 'English', bcp47: 'en' });
  });

  it('reads a JSON-serialized ILanguage object', () => {
    expect(
      parseStepLanguageField('{"languageName":"French","bcp47":"fr"}')
    ).toEqual({ languageName: 'French', bcp47: 'fr' });
  });

  it('defaults bcp47 to und for an object missing bcp47', () => {
    expect(parseStepLanguageField({ languageName: 'English' })).toEqual({
      languageName: 'English',
      bcp47: 'und',
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
    label === orgDefaultLangProps
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
      label === orgDefaultLangProps
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

  it('uses step language for PBT when artifactTypeId is a remote id', async () => {
    const state = await buildWorkflowAsrStateFromSettings(
      {
        artifactTypeId: '99',
        language: 'English|en',
      },
      slugFromId,
      getOrgDefault,
      'org-1',
      asrDefault
    );
    expect(state.asrIso).toBe('eng');
    expect(state.asrIso).not.toBe('und');
  });

  it('uses sister language when primary is not ASR-supported', async () => {
    const state = await buildWorkflowAsrStateFromSettings(
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
    expect(state.asrIso).toBe('eng');
    expect(state.language.languageName).toBe('English');
    expect(state.language.bcp47).toBe('en');
  });

  it('propagates the persisted selectRoman (transliterate) flag', async () => {
    const state = await buildWorkflowAsrStateFromSettings(
      {
        artifactTypeId: '99',
        language: 'Klingon|tlh',
        sisterlanguage: 'English|en',
        selectRoman: true,
      },
      slugFromId,
      getOrgDefault,
      'org-1',
      asrDefault
    );
    expect(state.selectRoman).toBe(true);
  });
});

describe('buildWorkflowAsrStateFromSettings Q&A and Retell', () => {
  const slugFromId = (id: string) =>
    id === 'qa'
      ? ArtifactTypeSlug.QandA
      : id === 'retell'
        ? ArtifactTypeSlug.Retell
        : ArtifactTypeSlug.Vernacular;

  it('Q&A uses org default asr for target and resolved language', async () => {
    const getOrgDefault = (label: string) => {
      if (label === orgDefaultLangProps) {
        return {
          bcp47: 'tlh',
          languageName: 'Klingon',
          font: 'font1',
          rtl: true,
        };
      }
      if (label === orgDefaultAsr) {
        return {
          target: AsrTarget.phonetic,
          language: {
            bcp47: 'en',
            languageName: 'English',
            font: '',
            rtl: false,
            spellCheck: false,
          },
          asrIso: 'eng',
          method: 'whisper',
          dialect: undefined,
          selectRoman: false,
        };
      }
      return undefined;
    };
    const state = await buildWorkflowAsrStateFromSettings(
      { artifactTypeId: 'qa' },
      slugFromId,
      getOrgDefault,
      'org-1',
      asrDefault
    );
    expect(state.target).toBe(AsrTarget.phonetic);
    expect(state.asrIso).toBe('eng');
    expect(state.language.bcp47).toBe('en');
    expect(state.language.font).toBe('font1');
    expect(state.language.rtl).toBe(true);
  });
});

describe('buildVernacularAsrState', () => {
  const getOrgDefault = (label: string) =>
    label === orgDefaultLangProps
      ? { bcp47: 'tlh', languageName: 'Klingon', font: '', rtl: false }
      : undefined;

  it('prefers org default asr over unsupported org langProps', async () => {
    const getOrgDefaultWithAsr = (label: string) => {
      if (label === orgDefaultLangProps) {
        return { bcp47: 'tlh', languageName: 'Klingon', font: '', rtl: false };
      }
      if (label === orgDefaultAsr) {
        return {
          target: AsrTarget.alphabet,
          language: {
            bcp47: 'en',
            languageName: 'English',
            font: '',
            rtl: false,
            spellCheck: false,
          },
          asrIso: 'eng',
          method: 'whisper',
          dialect: undefined,
          selectRoman: false,
        };
      }
      return undefined;
    };
    const state = await buildVernacularAsrState(
      { artifactTypeId: 'retell' },
      getOrgDefaultWithAsr,
      'org-1',
      asrDefault
    );
    expect(state.asrIso).toBe('eng');
    expect(state.language.languageName).toBe('English');
    expect(state.language.bcp47).toBe('en');
  });

  it('uses sister languageName from sisterlanguage field', async () => {
    const state = await buildVernacularAsrState(
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
    expect(state.asrIso).toBe('eng');
    expect(state.language.languageName).toBe('English');
  });

  it('leaves the method unset when the step kept the default', async () => {
    const state = await buildVernacularAsrState(
      {
        sisterlanguage: formatStepLanguageField({
          languageName: 'English',
          bcp47: 'en',
        }),
        asrMethod: 'default',
      },
      getOrgDefault,
      'org-1',
      asrDefault
    );
    expect(state.asrMethod).toBeUndefined();
  });

  it('keeps the team default method when the step did not choose one', async () => {
    const getOrgDefaultWithAsr = (label: string) => {
      if (label === orgDefaultLangProps) {
        return { bcp47: 'am', languageName: 'Amharic', font: '', rtl: false };
      }
      if (label === orgDefaultAsr) {
        return {
          target: AsrTarget.alphabet,
          language: {
            bcp47: 'am',
            languageName: 'Amharic',
            font: '',
            rtl: false,
            spellCheck: false,
          },
          asrIso: 'amh',
          asrMethod: 'whisper',
          dialect: undefined,
          selectRoman: false,
        };
      }
      return undefined;
    };
    const state = await buildVernacularAsrState(
      {},
      getOrgDefaultWithAsr,
      'org-1',
      asrDefault
    );
    expect(state.asrMethod).toBe('whisper');
  });

  it('keeps a method the step chose', async () => {
    const state = await buildVernacularAsrState(
      {
        sisterlanguage: formatStepLanguageField({
          languageName: 'English',
          bcp47: 'en',
        }),
        asrMethod: 'mms',
      },
      getOrgDefault,
      'org-1',
      asrDefault
    );
    expect(state.asrMethod).toBe('mms');
  });

  it('propagates the persisted selectRoman (transliterate) flag', async () => {
    const state = await buildVernacularAsrState(
      {
        sisterlanguage: formatStepLanguageField({
          languageName: 'English',
          bcp47: 'en',
        }),
        selectRoman: true,
      },
      getOrgDefault,
      'org-1',
      asrDefault
    );
    expect(state.selectRoman).toBe(true);
  });

  it('uses the team default over values older builds left on the step', async () => {
    const getOrgDefaultWithAsr = (label: string) => {
      if (label === orgDefaultLangProps) {
        return { bcp47: 'am', languageName: 'Amharic', font: '', rtl: false };
      }
      if (label === orgDefaultAsr) {
        return {
          target: AsrTarget.alphabet,
          language: {
            bcp47: 'am',
            languageName: 'Amharic',
            font: '',
            rtl: false,
            spellCheck: false,
          },
          asrIso: 'amh',
          asrMethod: 'whisper',
          dialect: undefined,
          selectRoman: false,
        };
      }
      return undefined;
    };
    const state = await buildVernacularAsrState(
      {
        sisterlanguage: formatStepLanguageField({
          languageName: 'English',
          bcp47: 'en',
        }),
        asrMethod: 'mms',
        phonetic: true,
        selectRoman: true,
      },
      getOrgDefaultWithAsr,
      'org-1',
      asrDefault
    );
    expect(state.asrIso).toBe('amh');
    expect(state.asrMethod).toBe('whisper');
    expect(state.target).toBe(AsrTarget.alphabet);
    expect(state.selectRoman).toBe(false);
  });

  it('with nothing saved, uses the team language when it can be transcribed', async () => {
    const state = await buildVernacularAsrState(
      {},
      (label: string) =>
        label === orgDefaultLangProps
          ? { bcp47: 'am', languageName: 'Amharic', font: '', rtl: false }
          : undefined,
      'org-1',
      asrDefault,
      undefined,
      'tok'
    );
    expect(state.asrIso).toBe('amh');
    expect(state.language.languageName).toBe('Amharic');
  });

  it('with nothing saved, leaves the language unset when the team language needs a sister', async () => {
    const state = await buildVernacularAsrState(
      {},
      getOrgDefault,
      'org-1',
      asrDefault,
      undefined,
      'tok'
    );
    expect(state.asrIso).toBe('und');
  });

  it('clears transliterate when phonetic is selected', async () => {
    const state = await buildVernacularAsrState(
      {
        sisterlanguage: formatStepLanguageField({
          languageName: 'English',
          bcp47: 'en',
        }),
        phonetic: true,
        selectRoman: true,
      },
      getOrgDefault,
      'org-1',
      asrDefault
    );
    expect(state.target).toBe(AsrTarget.phonetic);
    expect(state.selectRoman).toBe(false);
  });
});

describe('buildVernacularAsrState project language override', () => {
  // Org default vernacular is Klingon (not ASR-supported) with an English sister.
  const getOrgDefault = (label: string) =>
    label === orgDefaultLangProps
      ? { bcp47: 'tlh', languageName: 'Klingon', font: '', rtl: false }
      : undefined;
  const settings = {
    sisterlanguage: formatStepLanguageField({
      languageName: 'English',
      bcp47: 'en',
    }),
    selectRoman: true,
  };

  it('defaults to step settings (sister) when project matches org default', async () => {
    const projectLang = {
      bcp47: 'tlh',
      languageName: 'Klingon',
      font: 'pf',
      rtl: false,
      spellCheck: false,
    };
    const state = await buildVernacularAsrState(
      settings,
      getOrgDefault,
      'org-1',
      asrDefault,
      projectLang
    );
    expect(state.asrIso).toBe('eng');
    expect(state.language.bcp47).toBe('en');
    expect(state.language.languageName).toBe('English');
    expect(state.selectRoman).toBe(true);
  });

  it('uses the project language and drops the sister when it differs', async () => {
    const projectLang = {
      bcp47: 'en',
      languageName: 'Project English',
      font: 'pf',
      rtl: false,
      spellCheck: false,
    };
    const state = await buildVernacularAsrState(
      settings,
      getOrgDefault,
      'org-1',
      asrDefault,
      projectLang
    );
    expect(state.asrIso).toBe('eng');
    expect(state.language.bcp47).toBe('en');
    expect(state.language.languageName).toBe('Project English');
    expect(state.language.font).toBe('pf');
    // sister + transliterate were configured for the org default language.
    expect(state.selectRoman).toBe(false);
  });

  it('does not send the step method for a project in another language', async () => {
    const projectLang = {
      bcp47: 'en',
      languageName: 'Project English',
      font: 'pf',
      rtl: false,
      spellCheck: false,
    };
    const state = await buildVernacularAsrState(
      { ...settings, asrMethod: 'mms' },
      getOrgDefault,
      'org-1',
      asrDefault,
      projectLang
    );
    expect(state.asrMethod).toBeUndefined();
  });

  it('keeps the step method when the project matches the team language', async () => {
    const projectLang = {
      bcp47: 'tlh',
      languageName: 'Klingon',
      font: 'pf',
      rtl: false,
      spellCheck: false,
    };
    const state = await buildVernacularAsrState(
      { ...settings, asrMethod: 'mms' },
      getOrgDefault,
      'org-1',
      asrDefault,
      projectLang
    );
    expect(state.asrMethod).toBe('mms');
  });
});

describe('stepSettingsFromAsrState', () => {
  const asr = {
    target: AsrTarget.alphabet,
    language: {
      bcp47: 'en',
      languageName: 'English',
      font: 'charissil',
      rtl: false,
      spellCheck: false,
    },
    asrIso: 'eng',
    asrMethod: 'mms',
    dialect: undefined,
    selectRoman: true,
  };

  it('writes the sister language onto the step and leaves the step language', () => {
    expect(
      stepSettingsFromAsrState(
        { artifactTypeId: 'pbt', language: 'Kannada|kn' },
        asr
      )
    ).toEqual({
      artifactTypeId: 'pbt',
      language: 'Kannada|kn',
      sisterlanguage: 'English|en',
      phonetic: false,
      selectRoman: true,
      asrMethod: 'mms',
    });
  });

  it('writes a picked language as the step language when the step has none', () => {
    expect(
      stepSettingsFromAsrState({ artifactTypeId: 'pbt' }, asr).language
    ).toBe('English|en');
  });

  it('caches sister recommendations on the step for its own language', () => {
    const settings = { artifactTypeId: 'pbt', language: 'Kannada|kn' };
    expect(stepSisterRecommendationKey(settings)).toBe('Kannada');
    const stored = withSisterRecommendations(settings, 'Kannada', [
      {
        languageName: 'English',
        iso: 'eng',
        methods: ['mms'],
        reason: 'close',
      },
    ]);
    expect(stored).toMatchObject(settings);
    expect(readSisterRecommendations(stored, 'Kannada')).toEqual([
      {
        languageName: 'English',
        iso: 'eng',
        methods: ['mms'],
        reason: 'close',
      },
    ]);
    expect(readSisterRecommendations(stored, 'French')).toBeUndefined();
  });

  it('leaves the method out when none is chosen and drops transliterate for phonetic', () => {
    const next = stepSettingsFromAsrState(
      {
        artifactTypeId: 'pbt',
        language: 'Kannada|kn',
        selectRoman: true,
        asrMethod: 'default',
      },
      { ...asr, asrMethod: undefined, target: AsrTarget.phonetic }
    );
    expect(next).toMatchObject({
      language: 'Kannada|kn',
      phonetic: true,
      selectRoman: false,
    });
    expect(Object.hasOwn(next, 'asrMethod')).toBe(false);
  });

  it('stores a chosen method', () => {
    expect(
      stepSettingsFromAsrState(
        { artifactTypeId: 'pbt', language: 'Kannada|kn' },
        { ...asr, asrMethod: 'mms' }
      ).asrMethod
    ).toBe('mms');
  });
});
