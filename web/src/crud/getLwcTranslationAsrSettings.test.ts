jest.mock('../utils', () => ({
  JSONParse: (s: string) => JSON.parse(s),
  isLangSet: (bcp: string | undefined) =>
    Boolean(bcp && bcp !== 'und' && bcp.length > 0),
}));

import { ArtifactTypeSlug } from './artifactTypeSlug';
import { ToolSlug } from './toolSlug';
import {
  buildBoldClauseTranscriptionAsrState,
  buildLwcTranslationAsrState,
  boldClauseTranscriptionHasAsrLanguage,
  findLwcTranslationWorkflowStep,
  getLwcTranslationStepSettings,
  lwcTranslationHasAsrLanguage,
} from './getLwcTranslationAsrSettings';
import { AsrTarget } from '../business/asr/AsrTarget';
import { OrgWorkflowStepD } from '../model';
import { formatStepLanguageField } from './transcribeStepAsrSettings';

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
  method: 'whisper',
  dialect: undefined,
  selectRoman: false,
};

const slugFromId = (id: string) =>
  id === 'pbt-type-id' ? ArtifactTypeSlug.PhraseBackTranslation : id;

function lwcTranslationStep(): OrgWorkflowStepD {
  return {
    id: 'lwc-step',
    type: 'orgworkflowstep',
    attributes: {
      tool: JSON.stringify({
        tool: ToolSlug.PhraseBackTranslate,
        settings: {
          artifactTypeId: 'pbt-type-id',
          language: formatStepLanguageField({
            languageName: 'English',
            bcp47: 'en',
          }),
        },
      }),
    },
  } as OrgWorkflowStepD;
}

describe('findLwcTranslationWorkflowStep', () => {
  it('finds phrase back translate step with PBT artifact', () => {
    const steps = [
      {
        id: 'other',
        type: 'orgworkflowstep',
        attributes: {
          tool: JSON.stringify({
            tool: ToolSlug.Transcribe,
            settings: { artifactTypeId: 'pbt-type-id' },
          }),
        },
      } as OrgWorkflowStepD,
      lwcTranslationStep(),
    ];

    expect(findLwcTranslationWorkflowStep(steps, slugFromId)?.id).toBe(
      'lwc-step'
    );
  });
});

describe('getLwcTranslationStepSettings', () => {
  it('returns language from upstream LWC Translation step', () => {
    const settings = getLwcTranslationStepSettings(
      [lwcTranslationStep()],
      slugFromId
    );
    expect(settings.language).toBe('English|en');
  });
});

describe('buildLwcTranslationAsrState', () => {
  it('builds ASR state from upstream step language', () => {
    const getOrgDefault = () => undefined;
    const asr = buildLwcTranslationAsrState(
      [lwcTranslationStep()],
      slugFromId,
      getOrgDefault,
      'org1',
      asrDefault
    );
    expect(asr.language.bcp47).toBe('en');
    expect(asr.asrIso).toBe('eng');
  });
});

describe('lwcTranslationHasAsrLanguage', () => {
  it('returns true when upstream step has language', () => {
    const getOrgDefault = () => undefined;
    expect(
      lwcTranslationHasAsrLanguage(
        [lwcTranslationStep()],
        slugFromId,
        getOrgDefault,
        'org1'
      )
    ).toBe(true);
  });
});

describe('buildBoldClauseTranscriptionAsrState', () => {
  it('uses current Transcribe step language when upstream has none', () => {
    const getOrgDefault = () => undefined;
    const currentSettings = {
      artifactTypeId: 'pbt-type-id',
      language: formatStepLanguageField({
        languageName: 'English',
        bcp47: 'en',
      }),
    };
    const asr = buildBoldClauseTranscriptionAsrState(
      [],
      slugFromId,
      ToolSlug.PhraseBackTranslate,
      ArtifactTypeSlug.PhraseBackTranslation,
      getOrgDefault,
      'org1',
      asrDefault,
      undefined,
      currentSettings
    );
    expect(asr.language.bcp47).toBe('en');
    expect(asr.asrIso).toBe('eng');
  });

  it('prefers current Transcribe step over upstream when both have language', () => {
    const getOrgDefault = () => undefined;
    const currentSettings = {
      artifactTypeId: 'pbt-type-id',
      language: formatStepLanguageField({
        languageName: 'French',
        bcp47: 'fr',
      }),
    };
    const asr = buildBoldClauseTranscriptionAsrState(
      [lwcTranslationStep()],
      slugFromId,
      ToolSlug.PhraseBackTranslate,
      ArtifactTypeSlug.PhraseBackTranslation,
      getOrgDefault,
      'org1',
      asrDefault,
      undefined,
      currentSettings
    );
    expect(asr.language.bcp47).toBe('fr');
    expect(asr.asrIso).toBe('fra');
  });
});

describe('boldClauseTranscriptionHasAsrLanguage', () => {
  it('returns true when only current Transcribe step has language', () => {
    const getOrgDefault = () => undefined;
    const currentSettings = {
      artifactTypeId: 'pbt-type-id',
      language: formatStepLanguageField({
        languageName: 'English',
        bcp47: 'en',
      }),
    };
    expect(
      boldClauseTranscriptionHasAsrLanguage(
        [],
        slugFromId,
        ToolSlug.PhraseBackTranslate,
        ArtifactTypeSlug.PhraseBackTranslation,
        getOrgDefault,
        'org1',
        currentSettings
      )
    ).toBe(true);
  });

  it('returns true when language is on upstream step only', () => {
    const getOrgDefault = () => undefined;
    expect(
      boldClauseTranscriptionHasAsrLanguage(
        [lwcTranslationStep()],
        slugFromId,
        ToolSlug.PhraseBackTranslate,
        ArtifactTypeSlug.PhraseBackTranslation,
        getOrgDefault,
        'org1'
      )
    ).toBe(true);
  });
});
