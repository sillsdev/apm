import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

const teamAsr = {
  target: 'alphabet',
  language: {
    bcp47: 'en',
    languageName: 'English',
    font: 'charissil',
    rtl: false,
    spellCheck: false,
  },
  asrIso: 'eng',
  dialect: undefined,
  selectRoman: false,
};

const mockSaveTeamAsrSettings = jest.fn();
const mockSaveStepAsrSettings = jest.fn();
const mockShowMessage = jest.fn();
const mockFetchRecommendations = jest.fn();
const mockSeedSuggestions = jest.fn();
const mockGetCachedStepSisterRecommendations = jest.fn();
const mockSaveStepSisterRecommendations = jest.fn();
let mockCanSetTeamDefault = true;
let mockCanSetOrgDefault = true;
let mockNeedsSister = false;

jest.mock('../../crud/useGetAsrSettings', () => ({
  useGetAsrSettings: () => ({
    getAsrSettings: async () => teamAsr,
    getVernacularLanguage: () => ({ bcp47: 'en' }),
    getCachedSisterRecommendations: () => undefined,
    getCachedStepSisterRecommendations: () =>
      mockGetCachedStepSisterRecommendations(),
    saveSisterRecommendations: jest.fn(),
    saveStepSisterRecommendations: mockSaveStepSisterRecommendations,
    canSetTeamAsrDefault: () => mockCanSetTeamDefault,
    canSetOrgDefault: mockCanSetOrgDefault,
    saveTeamAsrSettings: mockSaveTeamAsrSettings,
    saveStepAsrSettings: mockSaveStepAsrSettings,
  }),
}));

jest.mock('./asrLanguages', () => ({
  explicitAsrMethod: () => undefined,
  isoFromBcp47: () => 'eng',
  needsSisterLanguage: async () => mockNeedsSister,
}));

jest.mock('./AsrSettings', () => ({
  AsrSettings: () => <div data-testid="asr-settings" />,
}));

jest.mock('./useRecommendAsrLanguage', () => ({
  useRecommendAsrLanguage: () => ({
    suggestions: [],
    loading: false,
    error: '',
    fetchRecommendations: mockFetchRecommendations,
    seedSuggestions: mockSeedSuggestions,
  }),
}));

jest.mock('../../control', () => ({
  ActionRow: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  rowSx: {},
}));

jest.mock('../../selector', () => ({
  sharedSelector: 'shared',
  transcriberSelector: 'transcriber',
}));

jest.mock('react-redux', () => ({
  shallowEqual: () => true,
  useSelector: () => ({
    asrSaveTeamDefault: 'Save as team default',
    asrTeamDefaultSaved: 'Saved as the team default.',
    asrRequestFailed: 'failed',
    run: 'Run',
    cancel: 'Cancel',
    mustBeOnline: 'online',
  }),
}));

jest.mock('../../context/TokenProvider', () => {
  const ReactActual = jest.requireActual('react') as typeof React;
  return {
    TokenContext: ReactActual.createContext({ state: { accessToken: 'tok' } }),
  };
});

jest.mock('../../context/useGlobal', () => ({
  useGlobal: () => [undefined],
}));

jest.mock('../../utils', () => ({
  logError: jest.fn(),
  Severity: { error: 1 },
}));

jest.mock('../../utils/useCheckOnline', () => ({
  useCheckOnline: () => (cb: (online: boolean) => void) => cb(true),
}));

jest.mock('../../utils/langTag', () => ({
  isLangSet: (bcp47?: string) => Boolean(bcp47 && bcp47 !== 'und'),
}));

jest.mock('../../hoc/SnackBar', () => ({
  useSnackBar: () => ({ showMessage: mockShowMessage }),
}));

import SelectAsrLanguage from './SelectAsrLanguage';

describe('SelectAsrLanguage', () => {
  beforeEach(() => {
    mockSaveTeamAsrSettings.mockReset();
    mockSaveStepAsrSettings.mockReset();
    mockShowMessage.mockReset();
    mockFetchRecommendations.mockReset();
    mockSeedSuggestions.mockReset();
    mockGetCachedStepSisterRecommendations.mockReset();
    mockSaveStepSisterRecommendations.mockReset();
    mockGetCachedStepSisterRecommendations.mockReturnValue(undefined);
    mockCanSetTeamDefault = true;
    mockCanSetOrgDefault = true;
    mockNeedsSister = false;
  });

  it('lets an admin save the dialog settings as the team default without closing', async () => {
    const onClose = jest.fn();
    render(<SelectAsrLanguage onClose={onClose} />);
    await screen.findByTestId('asr-settings');

    fireEvent.click(
      screen.getByRole('button', { name: 'Save as team default' })
    );

    expect(mockSaveTeamAsrSettings).toHaveBeenCalledWith(
      expect.objectContaining({ asrIso: 'eng' })
    );
    expect(mockShowMessage).toHaveBeenCalledWith('Saved as the team default.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('runs with the team default settings, without saving them', async () => {
    const onClose = jest.fn();
    render(<SelectAsrLanguage onClose={onClose} />);
    await screen.findByTestId('asr-settings');

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));

    expect(onClose).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ asrIso: 'eng' })
    );
    expect(mockSaveTeamAsrSettings).not.toHaveBeenCalled();
  });

  it('hides the team default button from non-admins', async () => {
    mockCanSetTeamDefault = false;
    render(<SelectAsrLanguage onClose={jest.fn()} />);
    await screen.findByTestId('asr-settings');

    expect(
      screen.queryByRole('button', { name: 'Save as team default' })
    ).not.toBeInTheDocument();
  });

  it('saves step-language ASR onto the step, not the team default', async () => {
    const onClose = jest.fn();
    render(
      <SelectAsrLanguage
        onClose={onClose}
        stepAsr={{ primaryBcp47: 'kn', asr: teamAsr }}
      />
    );
    await screen.findByTestId('asr-settings');

    fireEvent.click(
      screen.getByRole('button', { name: 'Save as team default' })
    );

    expect(mockSaveStepAsrSettings).toHaveBeenCalledWith(
      expect.objectContaining({ asrIso: 'eng' })
    );
    expect(mockSaveTeamAsrSettings).not.toHaveBeenCalled();
    expect(mockShowMessage).toHaveBeenCalledWith('Saved as the team default.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('reuses sister recommendations cached on a step with its own language', async () => {
    mockNeedsSister = true;
    const cached = [{ languageName: 'English', iso: 'eng', methods: ['mms'] }];
    mockGetCachedStepSisterRecommendations.mockReturnValue(cached);
    render(
      <SelectAsrLanguage
        onClose={jest.fn()}
        stepAsr={{ primaryBcp47: 'kn', asr: teamAsr }}
      />
    );
    await screen.findByTestId('asr-settings');

    expect(mockSeedSuggestions).toHaveBeenCalledWith(cached);
    expect(mockFetchRecommendations).not.toHaveBeenCalled();
  });

  it('stores sister recommendations on a step with its own language', async () => {
    mockNeedsSister = true;
    render(
      <SelectAsrLanguage
        onClose={jest.fn()}
        stepAsr={{ primaryBcp47: 'kn', asr: teamAsr }}
      />
    );
    await screen.findByTestId('asr-settings');

    expect(mockFetchRecommendations).toHaveBeenCalledWith(
      'eng',
      mockSaveStepSisterRecommendations
    );
  });

  it('hides step-language save from non-admins', async () => {
    mockCanSetOrgDefault = false;
    render(
      <SelectAsrLanguage
        onClose={jest.fn()}
        stepAsr={{ primaryBcp47: 'kn', asr: teamAsr }}
      />
    );
    await screen.findByTestId('asr-settings');

    expect(
      screen.queryByRole('button', { name: 'Save as team default' })
    ).not.toBeInTheDocument();
  });
});
