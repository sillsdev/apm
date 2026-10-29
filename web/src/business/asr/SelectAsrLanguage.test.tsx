import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';

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
const mockSaveProjectAsrSettings = jest.fn();
const mockShowMessage = jest.fn();
const mockFetchRecommendations = jest.fn();
const mockSeedSuggestions = jest.fn();
const mockGetCachedStepSisterRecommendations = jest.fn();
const mockSaveStepSisterRecommendations = jest.fn();
let mockCanSetTeamDefault = true;
let mockCanSetOrgDefault = true;
let mockNeedsSister = false;
// The method saved with the settings the dialog opens on.
let mockSavedMethod: string | undefined;
// The transcription type saved with those settings, when not the fixture's.
let mockSavedTarget: string | undefined;
// The service's method list for the ASR language, or a failed lookup.
let mockMethodsLookup: () => Promise<string[]>;

jest.mock('../../crud/useGetAsrSettings', () => ({
  useGetAsrSettings: () => ({
    getAsrSettings: async () => ({
      ...teamAsr,
      asrMethod: mockSavedMethod,
      ...(mockSavedTarget ? { target: mockSavedTarget } : {}),
    }),
    getVernacularLanguage: () => ({ bcp47: 'en' }),
    getCachedSisterRecommendations: () => undefined,
    getCachedStepSisterRecommendations: (stepId?: string) =>
      mockGetCachedStepSisterRecommendations(stepId),
    saveSisterRecommendations: jest.fn(),
    saveStepSisterRecommendations: mockSaveStepSisterRecommendations,
    canSetTeamAsrDefault: () => mockCanSetTeamDefault,
    canSetOrgDefault: mockCanSetOrgDefault,
    saveTeamAsrSettings: mockSaveTeamAsrSettings,
    saveStepAsrSettings: mockSaveStepAsrSettings,
    saveProjectAsrSettings: mockSaveProjectAsrSettings,
  }),
}));

jest.mock('./asrLanguages', () => ({
  getMethodsForAsr: () => mockMethodsLookup(),
  isoFromBcp47: () => 'eng',
  needsSisterLanguage: async () => mockNeedsSister,
  cachedNeedsSisterLanguage: () => undefined,
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

// Run and the team save tidy the method first (a cached lookup), then act.
const settle = () => act(async () => {});
import { TokenContext } from '../../context/TokenProvider';

// The dialog only reads state.accessToken from the context.
const noToken = { state: { accessToken: null } } as never;

describe('SelectAsrLanguage', () => {
  beforeEach(() => {
    mockSaveTeamAsrSettings.mockReset();
    mockSaveStepAsrSettings.mockReset();
    mockSaveProjectAsrSettings.mockReset();
    mockShowMessage.mockReset();
    mockFetchRecommendations.mockReset();
    mockSeedSuggestions.mockReset();
    mockGetCachedStepSisterRecommendations.mockReset();
    mockSaveStepSisterRecommendations.mockReset();
    mockGetCachedStepSisterRecommendations.mockReturnValue(undefined);
    mockCanSetTeamDefault = true;
    mockCanSetOrgDefault = true;
    mockNeedsSister = false;
    mockSavedMethod = undefined;
    mockSavedTarget = undefined;
    mockMethodsLookup = async () => ['whisper', 'mms'];
  });

  it('lets an admin save the dialog settings as the team default without closing', async () => {
    const onClose = jest.fn();
    render(<SelectAsrLanguage onClose={onClose} />);
    await screen.findByTestId('asr-settings');

    fireEvent.click(
      screen.getByRole('button', { name: 'Save as team default' })
    );
    await settle();

    expect(mockSaveTeamAsrSettings).toHaveBeenCalledWith(
      expect.objectContaining({ asrIso: 'eng' })
    );
    expect(mockShowMessage).toHaveBeenCalledWith('Saved as the team default.');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('runs with the dialog settings, saving only for the project', async () => {
    const onClose = jest.fn();
    render(<SelectAsrLanguage onClose={onClose} />);
    await screen.findByTestId('asr-settings');

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await settle();

    expect(onClose).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ asrIso: 'eng' })
    );
    expect(mockSaveTeamAsrSettings).not.toHaveBeenCalled();
    // useGetAsrSettings decides whether the project's language needs its own.
    expect(mockSaveProjectAsrSettings).toHaveBeenCalledWith(
      expect.objectContaining({ asrIso: 'eng' })
    );
  });

  it('never saves the primary as the team ASR language when it needs a sister', async () => {
    // The team ASR names the vernacular itself, which needs a sister; phonetic
    // needs no language, so Save stays enabled.
    mockNeedsSister = true;
    mockSavedTarget = 'Phonetic';
    render(<SelectAsrLanguage onClose={jest.fn()} />);
    await screen.findByTestId('asr-settings');

    fireEvent.click(
      screen.getByRole('button', { name: 'Save as team default' })
    );
    await settle();

    expect(mockSaveTeamAsrSettings).toHaveBeenCalledWith(
      expect.objectContaining({ asrIso: 'und' })
    );
  });

  it('drops a method the service no longer lists when the user runs', async () => {
    mockSavedMethod = 'w2v-bert';
    const onClose = jest.fn();
    render(<SelectAsrLanguage onClose={onClose} />);
    await screen.findByTestId('asr-settings');

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await settle();

    expect(onClose).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ asrMethod: undefined })
    );
  });

  it('keeps the method when the method lookup fails', async () => {
    // A network error says nothing about the method; saving without it would
    // erase the team's choice.
    mockSavedMethod = 'mms';
    mockMethodsLookup = async () => {
      throw new Error('aero down');
    };
    render(<SelectAsrLanguage onClose={jest.fn()} />);
    await screen.findByTestId('asr-settings');

    fireEvent.click(
      screen.getByRole('button', { name: 'Save as team default' })
    );
    await settle();

    expect(mockSaveTeamAsrSettings).toHaveBeenCalledWith(
      expect.objectContaining({ asrMethod: 'mms' })
    );
  });

  it('keeps a method the service still lists when the user runs', async () => {
    mockSavedMethod = 'mms';
    const onClose = jest.fn();
    render(<SelectAsrLanguage onClose={onClose} />);
    await screen.findByTestId('asr-settings');

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await settle();

    expect(onClose).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ asrMethod: 'mms' })
    );
  });

  it('does not save step-language ASR to the project on Run', async () => {
    const onClose = jest.fn();
    render(
      <SelectAsrLanguage
        onClose={onClose}
        stepAsr={{ primaryBcp47: 'kn', asr: teamAsr, stepId: 'recording-step' }}
      />
    );
    await screen.findByTestId('asr-settings');

    fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    await settle();

    expect(onClose).toHaveBeenCalled();
    expect(mockSaveProjectAsrSettings).not.toHaveBeenCalled();
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
        stepAsr={{ primaryBcp47: 'kn', asr: teamAsr, stepId: 'recording-step' }}
      />
    );
    await screen.findByTestId('asr-settings');

    fireEvent.click(
      screen.getByRole('button', { name: 'Save as team default' })
    );
    await settle();

    // Saved to the step the settings are read from, not the current step.
    expect(mockSaveStepAsrSettings).toHaveBeenCalledWith(
      expect.objectContaining({ asrIso: 'eng' }),
      'recording-step'
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
        stepAsr={{ primaryBcp47: 'kn', asr: teamAsr, stepId: 'recording-step' }}
      />
    );
    await screen.findByTestId('asr-settings');

    expect(mockGetCachedStepSisterRecommendations).toHaveBeenCalledWith(
      'recording-step'
    );
    expect(mockSeedSuggestions).toHaveBeenCalledWith(cached);
    expect(mockFetchRecommendations).not.toHaveBeenCalled();
  });

  it('stores sister recommendations on a step with its own language', async () => {
    mockNeedsSister = true;
    render(
      <SelectAsrLanguage
        onClose={jest.fn()}
        stepAsr={{ primaryBcp47: 'kn', asr: teamAsr, stepId: 'recording-step' }}
      />
    );
    await screen.findByTestId('asr-settings');

    expect(mockFetchRecommendations).toHaveBeenCalledWith(
      'eng',
      expect.any(Function)
    );
    const found = [{ languageName: 'English', iso: 'eng', methods: ['mms'] }];
    const save = mockFetchRecommendations.mock.calls[0][1] as (
      s: typeof found
    ) => void;
    save(found);
    expect(mockSaveStepSisterRecommendations).toHaveBeenCalledWith(
      'recording-step',
      found
    );
  });

  it('hides the step save when no step to save to was found', async () => {
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

  it('hides step-language save from non-admins', async () => {
    mockCanSetOrgDefault = false;
    render(
      <SelectAsrLanguage
        onClose={jest.fn()}
        stepAsr={{ primaryBcp47: 'kn', asr: teamAsr, stepId: 'recording-step' }}
      />
    );
    await screen.findByTestId('asr-settings');

    expect(
      screen.queryByRole('button', { name: 'Save as team default' })
    ).not.toBeInTheDocument();
  });

  it('asks an offline session (no token) to go online instead of loading', () => {
    render(
      <TokenContext.Provider value={noToken}>
        <SelectAsrLanguage onClose={jest.fn()} />
      </TokenContext.Provider>
    );
    expect(screen.getByText('online')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
