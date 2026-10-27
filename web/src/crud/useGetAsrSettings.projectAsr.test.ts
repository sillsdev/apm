import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { renderHook } from '@testing-library/react';
import type { IAsrState } from '../business/asr/asrState';

let mockProjectLanguage = 'fr';
let mockOrgLanguage = 'en';
let mockProjectAsr: unknown = undefined;
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
    getOrgDefault: (label: string) =>
      label === 'langProps'
        ? { bcp47: mockOrgLanguage, languageName: 'Team language' }
        : undefined,
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

jest.mock('../hoc/useOrbitData', () => {
  // A vernacular Transcribe step (no artifactTypeId).
  const steps = [{ id: 'step-1', attributes: { tool: '{}' } }];
  return {
    useOrbitData: (table: string) => (table === 'orgworkflowstep' ? steps : []),
  };
});

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
});
