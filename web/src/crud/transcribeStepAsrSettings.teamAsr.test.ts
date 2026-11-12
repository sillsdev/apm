import { jest, describe, expect, it } from '@jest/globals';
import type { IAsrState } from '../business/asr/asrState';
import { AsrTarget } from '../business/asr/AsrTarget';

// The utils barrel and axios pull in modules Jest can't parse; these tests
// only need the pure helpers (see useGetAsrSettings.test.ts). Klingon is the
// one language the mocked service can't transcribe.
jest.mock('../utils', () => ({
  useJsonParams: () => ({ getParam: jest.fn(), setParam: jest.fn() }),
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

import {
  stepAsrFromSettings,
  stepEditorShowsLanguage,
  teamVernacularAsr,
  transcribeSettingsNeedSisterLanguage,
} from './transcribeStepAsrSettings';
import { orgDefaultAsr, orgDefaultLangProps } from './useOrgDefaults';

// An artifact id is its own slug in these tests.
const slugFromId = (id: string) => id;

const spanishAsr: IAsrState = {
  target: AsrTarget.phonetic,
  language: {
    bcp47: 'es',
    languageName: 'Spanish',
    font: '',
    rtl: false,
    spellCheck: false,
  },
  asrIso: 'spa',
  asrMethod: 'mms',
  dialect: undefined,
  selectRoman: false,
};

const teamDefaults =
  (teamAsr: unknown, teamBcp = 'tlh') =>
  (label: string) => {
    if (label === orgDefaultLangProps) return { bcp47: teamBcp };
    if (label === orgDefaultAsr) return teamAsr;
    return undefined;
  };

describe('stepAsrFromSettings', () => {
  it('reads the sister, phonetic, method and transliterate a step stores', () => {
    const asr = stepAsrFromSettings({
      sisterlanguage: 'Spanish|es',
      asrMethod: 'mms',
      selectRoman: true,
    });
    expect(asr.language.bcp47).toBe('es');
    expect(asr.asrIso).toBe('spa');
    expect(asr.asrMethod).toBe('mms');
    expect(asr.target).toBe(AsrTarget.alphabet);
    expect(asr.selectRoman).toBe(true);
  });

  it('drops transliterate for phonetic and treats default as no method', () => {
    const asr = stepAsrFromSettings({
      phonetic: true,
      selectRoman: true,
      asrMethod: 'default',
    });
    expect(asr.target).toBe(AsrTarget.phonetic);
    expect(asr.selectRoman).toBe(false);
    expect(asr.asrMethod).toBeUndefined();
    expect(asr.asrIso).toBe('und');
  });
});

describe('teamVernacularAsr', () => {
  it('is the team default when there is one', () => {
    const asr = teamVernacularAsr(teamDefaults(spanishAsr), 'org-1', {
      sisterlanguage: 'Italian|it',
    });
    expect(asr?.asrIso).toBe('spa');
    expect(asr?.target).toBe(AsrTarget.phonetic);
  });

  it('falls back to the values older builds kept on the step', () => {
    const asr = teamVernacularAsr(teamDefaults(undefined), 'org-1', {
      sisterlanguage: 'Italian|it',
      asrMethod: 'mms',
    });
    expect(asr?.language.bcp47).toBe('it');
    expect(asr?.asrMethod).toBe('mms');
  });

  it('is undefined when neither holds anything', () => {
    expect(
      teamVernacularAsr(teamDefaults(undefined), 'org-1', {})
    ).toBeUndefined();
  });
});

describe('transcribeSettingsNeedSisterLanguage for team-language steps', () => {
  it('needs a sister when the team language is not supported and none is saved', async () => {
    await expect(
      transcribeSettingsNeedSisterLanguage(
        { artifactTypeId: 'retell' },
        slugFromId,
        teamDefaults(undefined),
        'org-1',
        'tok'
      )
    ).resolves.toBe(true);
  });

  it('does not need one once the team default names a sister', async () => {
    await expect(
      transcribeSettingsNeedSisterLanguage(
        { artifactTypeId: 'qanda' },
        slugFromId,
        teamDefaults(spanishAsr),
        'org-1',
        'tok'
      )
    ).resolves.toBe(false);
  });

  it('does not need one when the team language is supported', async () => {
    await expect(
      transcribeSettingsNeedSisterLanguage(
        {},
        slugFromId,
        teamDefaults(undefined, 'am'),
        'org-1',
        'tok'
      )
    ).resolves.toBe(false);
  });
});

describe('stepEditorShowsLanguage', () => {
  it('shows a language (and its ASR settings) on Vernacular and own-language steps', () => {
    expect(stepEditorShowsLanguage('vernacular')).toBe(true);
    expect(stepEditorShowsLanguage('backtranslation')).toBe(true);
    expect(stepEditorShowsLanguage('carefulspeech')).toBe(true);
  });

  it('shows neither on Q&A and Retell, which use the team language', () => {
    expect(stepEditorShowsLanguage('qanda')).toBe(false);
    expect(stepEditorShowsLanguage('retell')).toBe(false);
  });
});
