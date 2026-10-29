import React, { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AsrTarget } from './AsrTarget';
import type { IAsrState } from './asrState';

const getMethodsForAsr = jest.fn();

jest.mock('./asrLanguages', () => {
  const actual = jest.requireActual(
    './asrLanguages'
  ) as typeof import('./asrLanguages');
  return {
    ...actual,
    needsSisterLanguage: jest.fn(async () => false),
    getMethodsForAsr: (...args: unknown[]) => getMethodsForAsr(...args),
  };
});

jest.mock('./AsrAlphabet', () => ({
  AsrAlphabet: () => null,
}));

jest.mock('./asrScriptDetail', () => ({
  asrScriptDetail: () => ({ showRoman: false }),
}));

jest.mock('mui-language-picker', () => ({
  getLangTag: () => ({ iso639_3: 'eng', tag: 'en' }),
}));

jest.mock('../../selector', () => ({
  transcriberSelector: 'transcriber',
}));

jest.mock('react-redux', () => ({
  shallowEqual: () => true,
  useSelector: () => ({
    transcriptionType: 'Type',
    scriptTranscription: 'Script',
    phonetic: 'Phonetic',
    phoneticTip: 'tip',
    asrMethod: 'Method',
    asrMethodDefault: 'Default ({0})',
    asrMethodHint: 'hint',
    asrRequestFailed: 'failed',
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

import { AsrSettings } from './AsrSettings';
import { TokenContext } from '../../context/TokenProvider';

const asrState = (method: string | undefined): IAsrState => ({
  target: AsrTarget.alphabet,
  language: {
    bcp47: 'en',
    languageName: 'English',
    font: 'charissil',
    rtl: false,
    spellCheck: false,
  },
  asrIso: 'eng',
  asrMethod: method,
  dialect: undefined,
  selectRoman: false,
});

function Harness({
  method,
  token = 'tok',
}: {
  method: string | undefined;
  token?: string | null;
}) {
  const [asr, setAsr] = useState<IAsrState | undefined>(asrState(method));
  // The test only reads state.accessToken from the context.
  const tokenValue = { state: { accessToken: token } } as never;
  return (
    <TokenContext.Provider value={tokenValue}>
      <span data-testid="chosen">{asr?.asrMethod ?? 'default'}</span>
      <AsrSettings
        asr={asr ?? asrState(method)}
        setAsr={setAsr}
        vernacularBcp47="en"
        suggestions={[]}
        loading={false}
        error=""
      />
    </TokenContext.Provider>
  );
}

describe('AsrSettings method list', () => {
  beforeEach(() => {
    getMethodsForAsr.mockReset();
  });

  it('shows Default for a method the service no longer lists, without saving it', async () => {
    getMethodsForAsr.mockResolvedValue(['whisper', 'w2v-bert']);
    render(<Harness method="mms" />);

    expect(
      await screen.findByRole('radio', { name: 'Default (whisper)' })
    ).toBeChecked();
    expect(
      screen.queryByRole('radio', { name: 'mms' })
    ).not.toBeInTheDocument();
    // Rendering never changes the saved settings.
    expect(screen.getByTestId('chosen')).toHaveTextContent('mms');
  });

  it('drops that method when the user changes the settings', async () => {
    getMethodsForAsr.mockResolvedValue(['whisper', 'w2v-bert']);
    render(<Harness method="mms" />);
    await screen.findByRole('radio', { name: 'Default (whisper)' });

    fireEvent.click(screen.getByRole('radio', { name: 'Phonetic' }));

    expect(screen.getByTestId('chosen')).toHaveTextContent('default');
  });

  it('shows Default for the method the service ranks first, without saving it', async () => {
    getMethodsForAsr.mockResolvedValue(['whisper', 'mms']);
    render(<Harness method="whisper" />);

    expect(
      await screen.findByRole('radio', { name: 'Default (whisper)' })
    ).toBeChecked();
    expect(screen.getByTestId('chosen')).toHaveTextContent('whisper');
  });

  it('keeps a method the service still lists', async () => {
    getMethodsForAsr.mockResolvedValue(['whisper', 'mms']);
    render(<Harness method="mms" />);

    expect(await screen.findByRole('radio', { name: 'mms' })).toBeChecked();
    expect(screen.getByTestId('chosen')).toHaveTextContent('mms');
  });

  it('keeps the chosen method while there is no token', async () => {
    getMethodsForAsr.mockResolvedValue([]);
    render(<Harness method="mms" token={null} />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getMethodsForAsr).not.toHaveBeenCalled();
    expect(screen.getByTestId('chosen')).toHaveTextContent('mms');
  });

  it('keeps the chosen method when no methods are listed yet', async () => {
    getMethodsForAsr.mockResolvedValue([]);
    render(<Harness method="mms" />);

    await waitFor(() => expect(getMethodsForAsr).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.getByTestId('chosen')).toHaveTextContent('mms');
  });
});
