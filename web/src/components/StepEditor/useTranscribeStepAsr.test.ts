import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { act, renderHook } from '@testing-library/react';
import type { IAsrState } from '../../business/asr/asrState';
import { AsrTarget } from '../../business/asr/AsrTarget';

const setOrgDefault = jest.fn();
let mockTeamAsr: IAsrState | undefined;
const needsSisterLanguage = jest.fn(async () => false);

jest.mock('../../crud/useOrgDefaults', () => ({
  orgDefaultAsr: 'asr',
  orgDefaultLangProps: 'langProps',
  useOrgDefaults: () => ({
    getOrgDefault: (label: string) => {
      if (label === 'asr') return mockTeamAsr;
      // The team language: Amharic.
      if (label === 'langProps')
        return { bcp47: 'am', languageName: 'Amharic', font: '', rtl: false };
      return undefined;
    },
    setOrgDefault,
  }),
}));

jest.mock('../../crud/useAsrDefaultsVersion', () => ({
  useAsrDefaultsVersion: () => '',
}));

// Like the real hook, showMessage is a new function on every render.
jest.mock('../../hoc/useSnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: (key: string) => (key === 'offlineOnly' ? [false] : ['reporter']),
}));

jest.mock('../../utils/logErrorService', () => ({
  Severity: { error: 1 },
  logError: jest.fn(),
}));

// useNeedsSisterLanguage reads the token.
jest.mock('../../context/TokenProvider', () => {
  const React = jest.requireActual('react') as typeof import('react');
  return {
    TokenContext: React.createContext({ state: { accessToken: 'tok' } }),
  };
});

jest.mock('react-redux', () => ({
  shallowEqual: () => true,
  useSelector: () => ({
    asrRequestFailed: 'failed',
  }),
}));

jest.mock('../../business/asr/asrLanguages', () => ({
  isoFromBcp47: (bcp: string) => (bcp === 'und' ? 'und' : `${bcp}-iso`),
  needsSisterLanguage: () => needsSisterLanguage(),
  cachedNeedsSisterLanguage: () => undefined,
  resolveAsrBcp47: async (bcp: string) => bcp,
}));

import { useTranscribeStepAsr } from './useTranscribeStepAsr';

const amharic = {
  bcp47: 'am',
  languageName: 'Amharic',
  font: '',
  rtl: false,
  spellCheck: false,
};

const teamAsr: IAsrState = {
  target: AsrTarget.alphabet,
  language: amharic,
  asrIso: 'am-iso',
  asrMethod: undefined,
  dialect: undefined,
  selectRoman: false,
};

const renderStepAsr = (currentSlug: string, toolSettings = '{}') => {
  const onChange = jest.fn();
  const view = renderHook(() =>
    useTranscribeStepAsr({
      org: 'org-1',
      toolSettings,
      onChange,
      primaryBcp47: 'am',
      currentSlug,
    })
  );
  return { ...view, onChange };
};

describe('useTranscribeStepAsr', () => {
  beforeEach(() => {
    setOrgDefault.mockReset();
    needsSisterLanguage.mockReset();
    needsSisterLanguage.mockImplementation(async () => false);
    mockTeamAsr = teamAsr;
  });

  it('shows the team default on a Vernacular, Q&A or Retell step', () => {
    const { result } = renderStepAsr(
      'retell',
      '{"sisterlanguage":"Italian|it"}'
    );
    expect(result.current.asr.language.bcp47).toBe('am');
  });

  it('saves a method chosen there to the team default, not the step', () => {
    const { result, onChange } = renderStepAsr('vernacular');
    act(() => result.current.setAsr({ ...teamAsr, asrMethod: 'mms' }));
    expect(setOrgDefault).toHaveBeenCalledWith(
      'asr',
      expect.objectContaining({ asrMethod: 'mms' }),
      'org-1'
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  // Let the sister check answer before the user saves.
  const answered = () => act(async () => {});

  it('saves the team language as the ASR language when it needs no sister', async () => {
    const { result } = renderStepAsr('vernacular');
    await answered();
    act(() => result.current.setAsr({ ...teamAsr, asrMethod: 'mms' }));
    expect(setOrgDefault).toHaveBeenCalledWith(
      'asr',
      expect.objectContaining({ asrIso: 'am-iso', asrMethod: 'mms' }),
      'org-1'
    );
  });

  it('saves no ASR language when the team language needs a sister and none is chosen', async () => {
    needsSisterLanguage.mockImplementation(async () => true);
    mockTeamAsr = {
      ...teamAsr,
      language: { ...amharic, bcp47: 'und' },
      asrIso: 'und',
    };
    const { result } = renderStepAsr('vernacular');
    await answered();
    act(() =>
      result.current.setAsr({ ...mockTeamAsr!, target: AsrTarget.phonetic })
    );
    expect(setOrgDefault).toHaveBeenCalledWith(
      'asr',
      expect.objectContaining({ asrIso: 'und' }),
      'org-1'
    );
  });

  it('saves no ASR language before the sister check has answered', () => {
    const { result } = renderStepAsr('vernacular');
    act(() => result.current.setAsr({ ...teamAsr, asrMethod: 'mms' }));
    expect(setOrgDefault).toHaveBeenCalledWith(
      'asr',
      expect.objectContaining({ asrIso: 'und' }),
      'org-1'
    );
  });

  it('saves a chosen sister as the team ASR language', () => {
    const spanish = {
      ...teamAsr,
      language: { ...amharic, bcp47: 'es', languageName: 'Spanish' },
      asrIso: 'es-iso',
    };
    mockTeamAsr = spanish;
    const { result } = renderStepAsr('vernacular');
    act(() => result.current.setAsr({ ...spanish, asrMethod: 'mms' }));
    expect(setOrgDefault).toHaveBeenCalledWith(
      'asr',
      expect.objectContaining({ asrIso: 'es-iso', asrMethod: 'mms' }),
      'org-1'
    );
  });

  it('saves phonetic to the team default and drops transliterate', () => {
    const roman = { ...teamAsr, selectRoman: true };
    mockTeamAsr = roman;
    const { result } = renderStepAsr('qanda');
    act(() => result.current.setAsr({ ...roman, target: AsrTarget.phonetic }));
    expect(setOrgDefault).toHaveBeenCalledWith(
      'asr',
      expect.objectContaining({
        target: AsrTarget.phonetic,
        selectRoman: false,
      }),
      'org-1'
    );
  });

  it('saves a new sister language with the default method', () => {
    const withMethod = { ...teamAsr, asrMethod: 'mms' };
    mockTeamAsr = withMethod;
    const { result } = renderStepAsr('vernacular');
    act(() =>
      result.current.setAsr({
        ...withMethod,
        language: { ...amharic, bcp47: 'es', languageName: 'Spanish' },
      })
    );
    expect(setOrgDefault).toHaveBeenCalledWith(
      'asr',
      expect.objectContaining({ asrIso: 'es-iso', asrMethod: undefined }),
      'org-1'
    );
  });

  it('saves ASR on a step with its own language to that step', () => {
    const { result, onChange } = renderStepAsr(
      'backtranslation',
      '{"language":"Tamil|ta"}'
    );
    act(() =>
      result.current.setAsr({ ...result.current.asr, asrMethod: 'mms' })
    );
    expect(setOrgDefault).not.toHaveBeenCalled();
    expect(JSON.parse(onChange.mock.calls[0][0] as string)).toEqual(
      expect.objectContaining({ language: 'Tamil|ta', asrMethod: 'mms' })
    );
  });

  it('checks the sister language once, not on every render', () => {
    const { rerender } = renderStepAsr('vernacular');
    rerender();
    rerender();
    expect(needsSisterLanguage).toHaveBeenCalledTimes(1);
  });
});
