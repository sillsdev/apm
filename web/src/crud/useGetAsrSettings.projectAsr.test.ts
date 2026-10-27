import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import type { IAsrState } from '../business/asr/asrState';

let mockProjectLanguage = 'fr';
let mockOrgLanguage = 'en';
let mockProjectAsr: unknown = undefined;
let mockOrgAsr: unknown = undefined;
const mockSetProjectDefault = jest.fn();

const mockMemory = {
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
    setOrgDefault: () => undefined,
    canSetOrgDefault: true,
  }),
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
jest.mock('../hoc/useOrbitData', () => ({
  useOrbitData: (table: string) =>
    table === 'orgworkflowstep'
      ? [{ id: 'step-1', attributes: { tool: mockStepTool } }]
      : [],
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

  it('runs with the project settings when the project language differs', async () => {
    mockProjectAsr = frenchAsr;
    const { result } = renderHook(() => useGetAsrSettings());
    await expect(result.current.getAsrSettings()).resolves.toEqual(
      expect.objectContaining({ asrIso: 'fra' })
    );
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
});
