import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react';

// Team defaults, by label, as the org record would hold them.
let mockDefaults: Record<string, unknown> = {};
const setOrgDefault = jest.fn((label: string, value: unknown) => {
  mockDefaults[label] = value;
});

jest.mock('./useOrgDefaults', () => ({
  orgDefaultAsr: 'asr',
  orgDefaultLangProps: 'langProps',
  useOrgDefaults: () => ({
    getOrgDefault: (label: string) => mockDefaults[label],
    setOrgDefault: (label: string, value: unknown) =>
      setOrgDefault(label, value),
  }),
}));

// Whether the service needs a sister for each language.
let mockNeedsSister: Record<string, boolean> = {};
jest.mock('../business/asr/asrLanguages', () => ({
  needsSisterLanguage: async (bcp47: string) => mockNeedsSister[bcp47] ?? false,
  isoFromBcp47: (bcp47: string) => `${bcp47}-iso`,
}));

jest.mock('../context/TokenProvider', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    TokenContext: React.createContext({ state: { accessToken: 'tok' } }),
  };
});

// Projects in local memory, for the new-project rule.
let mockProjects: unknown[] = [];
jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [{ cache: { query: () => mockProjects } }, () => undefined],
}));

import {
  useSetTeamLanguage,
  useSetTeamLanguageForNewProject,
} from './useSetTeamLanguage';

const lang = (bcp47: string, languageName: string) => ({
  bcp47,
  languageName,
  font: '',
  rtl: false,
  spellCheck: false,
});

const spanishSisterAsr = {
  target: 'Phonetic',
  language: lang('es', 'Spanish'),
  asrIso: 'spa',
  asrMethod: 'mms',
  dialect: undefined,
  selectRoman: true,
};

describe('useSetTeamLanguage', () => {
  beforeEach(() => {
    setOrgDefault.mockClear();
    mockDefaults = {
      langProps: lang('xx', 'Old'),
      asr: spanishSisterAsr,
    };
    mockNeedsSister = {};
  });

  it('then saves the new team language as the ASR language when it is supported', async () => {
    const { result } = renderHook(() => useSetTeamLanguage());
    result.current(lang('en', 'English'), 'org-1');

    await waitFor(() =>
      expect(mockDefaults.asr).toEqual(
        expect.objectContaining({
          language: lang('en', 'English'),
          asrIso: 'en-iso',
          target: 'Phonetic',
        })
      )
    );
  });

  it('leaves no ASR language when the new team language needs a sister', async () => {
    mockNeedsSister = { tlh: true };
    const { result } = renderHook(() => useSetTeamLanguage());
    result.current(lang('tlh', 'Klingon'), 'org-1');

    await Promise.resolve();
    await Promise.resolve();
    expect(mockDefaults.asr).toEqual(
      expect.objectContaining({ asrIso: 'und' })
    );
  });

  it('clears the ASR language, method and transliterate chosen for the old language', () => {
    const { result } = renderHook(() => useSetTeamLanguage());
    result.current(lang('en', 'English'), 'org-1');

    expect(mockDefaults.langProps).toEqual(lang('en', 'English'));
    expect(mockDefaults.asr).toEqual(
      expect.objectContaining({
        asrIso: 'und',
        asrMethod: undefined,
        selectRoman: false,
        // The transcription type is not tied to a language.
        target: 'Phonetic',
      })
    );
  });

  it('keeps the team ASR when the language does not change', () => {
    const { result } = renderHook(() => useSetTeamLanguage());
    result.current(lang('xx', 'Old, renamed'), 'org-1');

    expect(mockDefaults.asr).toBe(spanishSisterAsr);
    expect(setOrgDefault).toHaveBeenCalledTimes(1);
  });

  it('saves a supported language as the ASR language when the team had none saved', async () => {
    delete mockDefaults.asr;
    const { result } = renderHook(() => useSetTeamLanguage());
    result.current(lang('en', 'English'), 'org-1');

    // Nothing to clear first; the language follows once the service answers.
    expect(mockDefaults.asr).toBeUndefined();
    await waitFor(() =>
      expect(mockDefaults.asr).toEqual(
        expect.objectContaining({ asrIso: 'en-iso', target: 'Alphabet' })
      )
    );
  });
});

describe('useSetTeamLanguageForNewProject', () => {
  const projectIn = (language: string) => ({
    id: `p-${language}`,
    type: 'project',
    attributes: { language },
    relationships: {
      organization: { data: { type: 'organization', id: 'org-1' } },
    },
  });

  beforeEach(() => {
    setOrgDefault.mockClear();
    mockDefaults = { langProps: lang('xx', 'Old'), asr: spanishSisterAsr };
  });

  it('keeps the team language and its ASR while a project uses it', () => {
    mockProjects = [projectIn('xx')];
    const { result } = renderHook(() => useSetTeamLanguageForNewProject());
    result.current(lang('en', 'English'), 'org-1');

    expect(setOrgDefault).not.toHaveBeenCalled();
    expect(mockDefaults.asr).toBe(spanishSisterAsr);
  });

  it('takes the new project language, clearing the old ASR, when none uses it', () => {
    mockProjects = [projectIn('fr')];
    const { result } = renderHook(() => useSetTeamLanguageForNewProject());
    result.current(lang('en', 'English'), 'org-1');

    expect(mockDefaults.langProps).toEqual(lang('en', 'English'));
    expect(mockDefaults.asr).toEqual(
      expect.objectContaining({ asrIso: 'und', asrMethod: undefined })
    );
  });
});
