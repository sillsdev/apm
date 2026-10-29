import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import type { IAsrState } from '../business/asr/asrState';

let mockProjectLanguage = 'fr';
let mockOrgLanguage = 'en';
let mockProjectAsr: unknown = undefined;
let mockOrgAsr: unknown = undefined;
const mockSetProjectDefault = jest.fn();
// Team-default writes in order: the team-language helper's, then direct ones.
let mockTeamWrites: string[] = [];

const mockMemoryUpdate = jest.fn();
const mockMemory = {
  update: (...args: unknown[]) => mockMemoryUpdate(...args),
  cache: {
    query: (fn: (q: any) => any) =>
      fn({
        findRecord: ({ type, id }: { type: string; id: string }) => ({
          type,
          id,
          attributes: {
            language: mockProjectLanguage,
            languageName: 'Project language',
            defaultFont: '',
            rtl: false,
            spellCheck: false,
            defaultParams: '{}',
          },
        }),
      }),
  },
};

jest.mock('../utils/axios', () => ({
  axiosGet: jest.fn(async () => ['whisper']),
}));

jest.mock('../utils', () => {
  const json = jest.requireActual('../utils/jsonParse') as {
    JSONParse: (s: string) => unknown;
  };
  const lang = jest.requireActual('../utils/langTag') as {
    isLangSet: (bcp47: string | undefined) => boolean;
  };
  return { JSONParse: json.JSONParse, isLangSet: lang.isLangSet };
});

jest.mock('./useOrgDefaults', () => ({
  orgDefaultAsr: 'asr',
  orgDefaultLangProps: 'langProps',
  useOrgDefaults: () => ({
    getOrgDefault: (label: string) => {
      if (label === 'langProps')
        return { bcp47: mockOrgLanguage, languageName: 'Team language' };
      return label === 'asr' ? mockOrgAsr : undefined;
    },
    setOrgDefault: (label: string) => {
      mockTeamWrites.push(label);
    },
    canSetOrgDefault: true,
  }),
}));

jest.mock('./useSetTeamLanguage', () => ({
  useSetTeamLanguage: () => () => {
    mockTeamWrites.push('team language');
  },
}));

jest.mock('./useProjectDefaults', () => ({
  projDefSisterRecommendations: 'sisterRecommendations',
  useProjectDefaults: () => ({
    getProjectDefault: (label: string) =>
      label === 'asr' ? mockProjectAsr : undefined,
    setProjectDefault: (...args: unknown[]) => mockSetProjectDefault(...args),
  }),
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    const values: Record<string, unknown> = {
      memory: mockMemory,
      user: 'u',
      organization: 'org-1',
      project: 'proj-1',
    };
    return [values[key], () => undefined];
  },
}));

// The current step's tool settings; '{}' is a vernacular Transcribe step.
let mockStepTool = '{}';
// The step records from the latest render, so a test can see what was written.
let mockSteps: { id: string; attributes: { tool: string } }[] = [];
jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: (table: string) => {
    if (table !== 'orgworkflowstep') return [];
    mockSteps = [{ id: 'step-1', attributes: { tool: mockStepTool } }];
    return mockSteps;
  },
}));

jest.mock('./useArtifactType', () => ({
  useArtifactType: () => ({
    slugFromId: (id: string | null) => id || 'vernacular',
  }),
}));

jest.mock('../context/TokenProvider', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    TokenContext: React.createContext({ state: { accessToken: 'tok' } }),
  };
});

jest.mock('../context/PassageDetailContext', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    PassageDetailContext: React.createContext({
      state: { currentstep: 'step-1' },
    }),
  };
});

import { useGetAsrSettings } from './useGetAsrSettings';

const frenchAsr: IAsrState = {
  target: 'alphabet',
  language: {
    bcp47: 'fr',
    languageName: 'French',
    font: 'charissil',
    rtl: false,
    spellCheck: false,
  },
  asrIso: 'fra',
  dialect: undefined,
  selectRoman: false,
};

describe('useGetAsrSettings project ASR', () => {
  beforeEach(() => {
    mockProjectLanguage = 'fr';
    mockOrgLanguage = 'en';
    mockProjectAsr = undefined;
    mockOrgAsr = undefined;
    mockStepTool = '{}';
    mockMemoryUpdate.mockReset();
    mockTeamWrites = [];
    mockSetProjectDefault.mockReset();
  });

  it('saves the run settings on a project whose language differs from the team', () => {
    const { result } = renderHook(() => useGetAsrSettings());
    result.current.saveProjectAsrSettings(frenchAsr);
    expect(mockSetProjectDefault).toHaveBeenCalledWith('asr', frenchAsr);
  });

  it('saves nothing when the project language matches the team', () => {
    mockProjectLanguage = 'en';
    const { result } = renderHook(() => useGetAsrSettings());
    result.current.saveProjectAsrSettings(frenchAsr);
    expect(mockSetProjectDefault).not.toHaveBeenCalled();
  });

  it('does not rewrite settings the project already holds', () => {
    mockProjectAsr = { ...frenchAsr };
    const { result } = renderHook(() => useGetAsrSettings());
    result.current.saveProjectAsrSettings(frenchAsr);
    expect(mockSetProjectDefault).not.toHaveBeenCalled();
  });

  it('makes the project language and run settings the team default when the team has no language', () => {
    mockOrgLanguage = 'und';
    const { result } = renderHook(() => useGetAsrSettings());
    result.current.saveProjectAsrSettings(frenchAsr);
    expect(mockTeamWrites).toEqual(['team language', 'asr']);
    expect(mockSetProjectDefault).not.toHaveBeenCalledWith('asr', frenchAsr);
  });

  it('runs with the project settings when the project language differs', async () => {
    mockProjectAsr = frenchAsr;
    const { result } = renderHook(() => useGetAsrSettings());
    await expect(result.current.getAsrSettings()).resolves.toEqual(
      expect.objectContaining({ asrIso: 'fra' })
    );
  });

  it('uses the language of a new project, not the team sister', async () => {
    // Team language 'xx' transcribed through a Spanish sister;
    // the new project is French and has no saved choice of its own.
    mockOrgLanguage = 'xx';
    mockOrgAsr = {
      ...frenchAsr,
      language: { ...frenchAsr.language, bcp47: 'es', languageName: 'Spanish' },
      asrIso: 'spa',
    };
    mockStepTool = JSON.stringify({
      tool: 'transcribe',
      settings: JSON.stringify({ sisterlanguage: 'Spanish|es' }),
    });
    const { result } = renderHook(() => useGetAsrSettings());
    const asr = await result.current.getAsrSettings();
    expect(asr?.language?.bcp47).toBe('fr');
  });

  it('ignores a saved sister the project language does not need', async () => {
    // French can be transcribed directly (every language is supported here),
    // so a saved Spanish choice from an earlier Run no longer applies.
    mockProjectAsr = {
      ...frenchAsr,
      language: { ...frenchAsr.language, bcp47: 'es', languageName: 'Spanish' },
      asrIso: 'spa',
    };
    const { result } = renderHook(() => useGetAsrSettings());
    const asr = await result.current.getAsrSettings();
    expect(asr?.asrIso).not.toBe('spa');
    expect(asr?.language?.bcp47).toBe('fr');
  });

  it('does not use the team ASR for a project in another language', async () => {
    // The team has an ASR default but no language of its own.
    mockOrgLanguage = 'und';
    mockOrgAsr = { ...frenchAsr, asrIso: 'eng', language: { bcp47: 'en' } };
    const { result } = renderHook(() => useGetAsrSettings());
    const asr = await result.current.getAsrSettings();
    expect(asr?.asrIso).not.toBe('eng');
  });

  // slugFromId maps an artifactTypeId straight to its slug in this test.
  const stepFor = (artifactTypeId: string) =>
    JSON.stringify({
      tool: 'transcribe',
      settings: JSON.stringify({ artifactTypeId }),
    });

  it.each(['vernacular', 'qanda', 'retell'])(
    'uses and saves project ASR on a %s step',
    async (slug) => {
      mockStepTool = stepFor(slug);
      mockProjectAsr = frenchAsr;
      const { result } = renderHook(() => useGetAsrSettings());
      await expect(result.current.getAsrSettings()).resolves.toEqual(
        expect.objectContaining({ asrIso: 'fra' })
      );
      result.current.saveProjectAsrSettings({ ...frenchAsr, asrIso: 'spa' });
      expect(mockSetProjectDefault).toHaveBeenCalledWith(
        'asr',
        expect.objectContaining({ asrIso: 'spa' })
      );
    }
  );

  it.each(['backtranslation', 'wholebacktranslation', 'carefulspeech'])(
    'neither uses nor saves project ASR on a %s step',
    async (slug) => {
      mockStepTool = stepFor(slug);
      mockProjectAsr = frenchAsr;
      const { result } = renderHook(() => useGetAsrSettings());
      const asr = await result.current.getAsrSettings();
      expect(asr?.asrIso).not.toBe('fra');
      result.current.saveProjectAsrSettings({ ...frenchAsr, asrIso: 'spa' });
      expect(mockSetProjectDefault).not.toHaveBeenCalled();
    }
  );

  it('saves a team default to the team only, leaving workflow steps alone', () => {
    const original = JSON.stringify({
      tool: 'transcribe',
      settings: JSON.stringify({ sisterlanguage: 'Italian|it' }),
    });
    mockStepTool = original;
    const { result } = renderHook(() => useGetAsrSettings());
    result.current.saveTeamAsrSettings(frenchAsr);
    expect(mockSteps[0].attributes.tool).toBe(original);
    expect(mockMemoryUpdate).not.toHaveBeenCalled();
  });

  it('sets the team language through the helper before saving the team ASR', () => {
    // The helper clears the old language's team ASR; the new choice must land after.
    const { result } = renderHook(() => useGetAsrSettings());
    result.current.saveTeamAsrSettings(frenchAsr);
    expect(mockTeamWrites).toEqual(['team language', 'asr']);
  });

  it('resolves the team language when the team ASR has none and no step names one', async () => {
    // After the team language changes the team ASR keeps only its transcription
    // type. With no Transcribe step to go on (here: no tool), the team
    // language must still be used, or Run stays disabled.
    mockProjectLanguage = 'en';
    mockOrgLanguage = 'en';
    mockOrgAsr = {
      ...frenchAsr,
      language: { ...frenchAsr.language, bcp47: 'und', languageName: '' },
      asrIso: 'und',
      asrMethod: undefined,
    };
    mockStepTool = JSON.stringify({ settings: '{}' });
    const { result } = renderHook(() => useGetAsrSettings());
    const asr = await result.current.getAsrSettings();
    expect(asr?.language?.bcp47).toBe('en');
    expect(asr?.asrIso).not.toBe('und');
  });
});
