import { jest, describe, expect, it } from '@jest/globals';
import { renderHook } from '@testing-library/react';

const mockMemory = {
  cache: {
    query: (fn: (q: any) => any) =>
      fn({
        findRecord: ({ type, id }: { type: string; id: string }) => ({
          type,
          id,
          attributes: {
            language: 'en',
            languageName: 'English',
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
  return {
    JSONParse: json.JSONParse,
    isLangSet: lang.isLangSet,
    useJsonParams: () => ({
      getParam: () => undefined,
      setParam: () => '{}',
      willSetParam: () => false,
    }),
  };
});

const getOrgDefault = () => undefined;

jest.mock('./useOrgDefaults', () => ({
  orgDefaultAsr: 'asr',
  orgDefaultLangProps: 'langProps',
  useOrgDefaults: () => ({
    getOrgDefault,
    setOrgDefault: () => undefined,
    canSetOrgDefault: false,
  }),
}));

jest.mock('./useProjectDefaults', () => ({
  projDefSisterRecommendations: 'sisterRecommendations',
  useProjectDefaults: () => ({
    getProjectDefault: () => undefined,
    setProjectDefault: () => undefined,
  }),
}));

jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) => {
    const values: Record<string, unknown> = {
      memory: mockMemory,
      user: 'u',
      organization: 'org-1',
      project: 'proj-1',
      offline: false,
      offlineOnly: false,
      orgRole: 'Admin',
    };
    return [values[key], () => undefined];
  },
  useGetGlobal: () => (key: string) =>
    key === 'project' ? 'proj-1' : undefined,
}));

jest.mock('../hoc/useOrbitData', () => {
  const steps = [{ id: 'step-1', attributes: { tool: '{}' } }];
  return { useOrbitData: () => steps };
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

describe('useGetAsrSettings', () => {
  it('keeps getAsrSettings stable across renders when ASR inputs are unchanged', () => {
    const { result, rerender } = renderHook(() => useGetAsrSettings());
    const first = result.current.getAsrSettings;
    rerender();
    expect(result.current.getAsrSettings).toBe(first);
  });
});
