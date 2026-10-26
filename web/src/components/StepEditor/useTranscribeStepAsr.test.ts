import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { renderHook } from '@testing-library/react';

const setOrgDefault = jest.fn();
const buildVernacularAsrState = jest.fn(async () => ({ asrIso: 'eng' }));

jest.mock('../../crud/useArtifactType', () => ({
  useArtifactType: () => ({
    slugFromId: () => 'vernacular',
  }),
}));

jest.mock('../../crud/useOrgDefaults', () => ({
  orgDefaultAsr: 'asr',
  orgDefaultLangProps: 'langProps',
  useOrgDefaults: () => ({
    getOrgDefault: () => undefined,
    setOrgDefault,
  }),
}));

jest.mock('../../utils/logErrorService', () => ({
  Severity: { error: 1 },
  logError: jest.fn(),
}));

jest.mock('../../hoc/useSnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: (key: string) => (key === 'offlineOnly' ? [false] : ['reporter']),
}));

jest.mock('../../context/TokenProvider', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    TokenContext: React.createContext({ state: { accessToken: null } }),
  };
});

jest.mock('react-redux', () => ({
  shallowEqual: () => true,
  useSelector: () => ({
    asrRequestFailed: 'failed',
    asrSaveFailed: 'save failed',
    invalidSisterLang: 'invalid',
  }),
}));

jest.mock('../../business/asr/asrLanguages', () => ({
  isValidAsrLanguage: async () => true,
  isoFromBcp47: (bcp: string) => bcp,
  needsSisterLanguage: async () => false,
  explicitAsrMethod: (method: unknown) => method,
  resolveAsrBcp47: async (bcp: string) => bcp,
}));

jest.mock('../../crud/transcribeStepAsrSettings', () => {
  const actual = jest.requireActual(
    '../../crud/transcribeStepAsrSettings'
  ) as typeof import('../../crud/transcribeStepAsrSettings');
  return {
    ...actual,
    buildVernacularAsrState: () => buildVernacularAsrState(),
  };
});

import { useTranscribeStepAsr } from './useTranscribeStepAsr';

describe('useTranscribeStepAsr', () => {
  beforeEach(() => {
    setOrgDefault.mockReset();
    buildVernacularAsrState.mockClear();
  });

  it('does not write the team ASR default when there is no token', () => {
    const onChange = jest.fn();
    const { result } = renderHook(() =>
      useTranscribeStepAsr({
        org: 'org-1',
        toolSettings: '{}',
        onChange,
        primaryBcp47: 'und',
        currentSlug: 'vernacular',
        clearMethod: (settings) => settings,
      })
    );

    result.current.emitSettingsChange('{}');

    expect(onChange).toHaveBeenCalledWith('{}');
    expect(buildVernacularAsrState).not.toHaveBeenCalled();
    expect(setOrgDefault).not.toHaveBeenCalled();
  });
});
