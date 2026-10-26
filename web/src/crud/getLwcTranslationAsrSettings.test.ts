jest.mock('../utils', () => ({
  JSONParse: (s: string) => JSON.parse(s),
  isLangSet: (bcp: string | undefined) =>
    Boolean(bcp && bcp !== 'und' && bcp.length > 0),
}));

jest.mock('../utils/axios', () => ({
  axiosGet: jest.fn(async () => ['whisper']),
}));

jest.mock('../context/TokenProvider', () => ({
  TokenContext: {},
}));

import { ArtifactTypeSlug } from './artifactTypeSlug';
import { ToolSlug } from './toolSlug';
import {
  buildBoldClauseTranscriptionAsrState,
  boldClauseTranscriptionStepLanguage,
  findUpstreamRecordingWorkflowStep,
  getUpstreamRecordingStepSettings,
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
  asrMethod: 'whisper',
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

describe('findUpstreamRecordingWorkflowStep', () => {
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

    expect(
      findUpstreamRecordingWorkflowStep(
        steps,
        slugFromId,
        ToolSlug.PhraseBackTranslate,
        ArtifactTypeSlug.PhraseBackTranslation
      )?.id
    ).toBe('lwc-step');
  });
});

describe('getUpstreamRecordingStepSettings', () => {
  it('returns language from upstream LWC Translation step', () => {
    const settings = getUpstreamRecordingStepSettings(
      [lwcTranslationStep()],
      slugFromId,
      ToolSlug.PhraseBackTranslate,
      ArtifactTypeSlug.PhraseBackTranslation
    );
    expect(settings.language).toBe('English|en');
  });
});

describe('buildBoldClauseTranscriptionAsrState', () => {
  it('builds ASR state from the upstream LWC Translation step language', async () => {
    const asr = await buildBoldClauseTranscriptionAsrState(
      [lwcTranslationStep()],
      slugFromId,
      ToolSlug.PhraseBackTranslate,
      ArtifactTypeSlug.PhraseBackTranslation,
      () => undefined,
      'org1',
      asrDefault
    );
    expect(asr.language.bcp47).toBe('en');
    expect(asr.asrIso).toBe('eng');
  });

  it('uses current Transcribe step language when upstream has none', async () => {
    const getOrgDefault = () => undefined;
    const currentSettings = {
      artifactTypeId: 'pbt-type-id',
      language: formatStepLanguageField({
        languageName: 'English',
        bcp47: 'en',
      }),
    };
    const asr = await buildBoldClauseTranscriptionAsrState(
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

  it('prefers current Transcribe step over upstream when both have language', async () => {
    const getOrgDefault = () => undefined;
    const currentSettings = {
      artifactTypeId: 'pbt-type-id',
      language: formatStepLanguageField({
        languageName: 'French',
        bcp47: 'fr',
      }),
    };
    const asr = await buildBoldClauseTranscriptionAsrState(
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

  it('does not fall back to English for LWC when no step names a language', async () => {
    const asr = await buildBoldClauseTranscriptionAsrState(
      [],
      slugFromId,
      ToolSlug.PhraseBackTranslate,
      ArtifactTypeSlug.PhraseBackTranslation,
      () => undefined,
      'org1',
      asrDefault
    );
    expect(asr.asrIso).toBe('und');
    expect(asr.language.bcp47).toBe('und');
  });

  it('uses the org vernacular for Careful Speech when no step names a language', async () => {
    const getOrgDefault = (label: string) =>
      label === 'langProps'
        ? { bcp47: 'fr', languageName: 'French', font: '', rtl: false }
        : undefined;
    const asr = await buildBoldClauseTranscriptionAsrState(
      [],
      slugFromId,
      ToolSlug.CarefulSpeech,
      ArtifactTypeSlug.CarefulSpeech,
      getOrgDefault,
      'org1',
      asrDefault
    );
    expect(asr.asrIso).toBe('fra');
  });
});

describe('boldClauseTranscriptionStepLanguage', () => {
  const getOrgDefault = (label: string) =>
    label === 'langProps'
      ? { bcp47: 'ta', languageName: 'Tamil', font: '', rtl: false }
      : undefined;

  it('returns the LWC translation step language, not the vernacular', () => {
    expect(
      boldClauseTranscriptionStepLanguage({
        orgSteps: [lwcTranslationStep()],
        slugFromId,
        upstreamTool: ToolSlug.PhraseBackTranslate,
        recordingArtifactSlug: ArtifactTypeSlug.PhraseBackTranslation,
        getOrgDefault,
        orgId: 'org1',
      })
    ).toBe('en');
  });

  it('leaves the LWC language for the user to pick when there is no step language', () => {
    expect(
      boldClauseTranscriptionStepLanguage({
        orgSteps: [],
        slugFromId,
        upstreamTool: ToolSlug.PhraseBackTranslate,
        recordingArtifactSlug: ArtifactTypeSlug.PhraseBackTranslation,
        getOrgDefault,
        orgId: 'org1',
      })
    ).toBe('und');
  });

  it('uses the vernacular for Careful Speech without a step language', () => {
    expect(
      boldClauseTranscriptionStepLanguage({
        orgSteps: [],
        slugFromId,
        upstreamTool: ToolSlug.CarefulSpeech,
        recordingArtifactSlug: ArtifactTypeSlug.CarefulSpeech,
        getOrgDefault,
        orgId: 'org1',
      })
    ).toBeUndefined();
  });

  it('is undefined when the step uses the vernacular artifact', () => {
    const vernacularStep = {
      id: 'v',
      type: 'orgworkflowstep',
      attributes: {
        tool: JSON.stringify({
          tool: ToolSlug.PhraseBackTranslate,
          settings: { artifactTypeId: ArtifactTypeSlug.Vernacular },
        }),
      },
    } as OrgWorkflowStepD;
    expect(
      boldClauseTranscriptionStepLanguage({
        orgSteps: [vernacularStep],
        slugFromId,
        upstreamTool: ToolSlug.PhraseBackTranslate,
        recordingArtifactSlug: ArtifactTypeSlug.Vernacular,
        getOrgDefault,
        orgId: 'org1',
      })
    ).toBeUndefined();
  });
});
