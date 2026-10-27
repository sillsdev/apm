import { jest, describe, expect, it, beforeEach } from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react';

const getAsrSettings = jest.fn<() => Promise<unknown>>();
const logError = jest.fn();

jest.mock('../../../crud/useGetAsrSettings', () => ({
  useGetAsrSettings: () => ({
    getAsrSettings: () => getAsrSettings(),
  }),
}));

// Reloads after a saved default changes; its Orbit tables aren't under test.
jest.mock('../../../crud/useAsrDefaultsVersion', () => ({
  useAsrDefaultsVersion: () => '',
}));

jest.mock('../../../utils/useCheckOnline', () => ({
  useCheckOnline: () => (cb: (online: boolean) => void) => cb(true),
}));

jest.mock('../../../utils/useLocLangName', () => ({
  useLocLangName: () => [() => ''],
}));

jest.mock('../../../utils/logErrorService', () => ({
  Severity: { error: 1 },
  logError: (...args: unknown[]) => logError(...args),
}));

jest.mock('../../../context/useGlobal', () => ({
  useGlobal: () => ['reporter'],
}));

jest.mock('react-redux', () => ({
  shallowEqual: () => true,
  useSelector: () => ({
    asrRequestFailed: 'Speech recognition settings could not be loaded.',
  }),
}));

import { useTranscribeAsr } from './useTranscribeAsr';
import { Severity } from '../../../utils/logErrorService';

describe('useTranscribeAsr', () => {
  beforeEach(() => {
    getAsrSettings.mockReset();
    logError.mockReset();
  });

  it('reports a failed speech-recognition settings load', async () => {
    getAsrSettings.mockRejectedValue(new Error('languages failed'));
    const showMessage = jest.fn();
    renderHook(() =>
      useTranscribeAsr({
        team: undefined,
        sharedStr: { mustBeOnline: 'online' } as never,
        tPlayer: { recognizeSpeech: 'Recognize {0}' } as never,
        showMessage,
        onTextAdd: jest.fn(),
        getCurrentText: () => '',
      })
    );

    await waitFor(() => {
      expect(logError).toHaveBeenCalledWith(
        Severity.error,
        'reporter',
        expect.any(Error)
      );
    });
    expect(showMessage).toHaveBeenCalledWith(
      'Speech recognition settings could not be loaded.'
    );
  });

  it('runs transcription when the team default is usable', async () => {
    getAsrSettings.mockResolvedValue({
      target: 'alphabet',
      language: { bcp47: 'en', languageName: 'English' },
      asrIso: 'eng',
      dialect: undefined,
    });
    const { result } = renderHook(() =>
      useTranscribeAsr({
        team: undefined,
        sharedStr: { mustBeOnline: 'online' } as never,
        tPlayer: { recognizeSpeech: 'Recognize {0}' } as never,
        showMessage: jest.fn(),
        onTextAdd: jest.fn(),
        getCurrentText: () => '',
      })
    );
    await waitFor(() => expect(result.current.asrSettings?.asrIso).toBe('eng'));

    act(() => result.current.handleTranscribe());

    expect(result.current.asrProgressVisible).toBe(true);
    expect(result.current.asrLangVisible).toBe(false);
  });

  it('continues a transcription already running on the recording', async () => {
    getAsrSettings.mockResolvedValue({
      target: 'alphabet',
      language: { bcp47: 'und', languageName: '' },
      asrIso: 'und',
      dialect: undefined,
    });
    const { result } = renderHook(() =>
      useTranscribeAsr({
        team: undefined,
        sharedStr: { mustBeOnline: 'online' } as never,
        tPlayer: { recognizeSpeech: 'Recognize {0}' } as never,
        showMessage: jest.fn(),
        onTextAdd: jest.fn(),
        getCurrentText: () => '',
        hasActiveTask: true,
      })
    );
    await waitFor(() => expect(result.current.asrSettings?.asrIso).toBe('und'));

    act(() => result.current.handleTranscribe());

    expect(result.current.asrProgressVisible).toBe(true);
    expect(result.current.asrLangVisible).toBe(false);
    expect(result.current.asrOverride).toBe(result.current.asrSettings);
  });

  it('opens the ASR dialog when no language is set', async () => {
    getAsrSettings.mockResolvedValue({
      target: 'alphabet',
      language: { bcp47: 'und', languageName: '' },
      asrIso: 'und',
      dialect: undefined,
    });
    const { result } = renderHook(() =>
      useTranscribeAsr({
        team: undefined,
        sharedStr: { mustBeOnline: 'online' } as never,
        tPlayer: { recognizeSpeech: 'Recognize {0}' } as never,
        showMessage: jest.fn(),
        onTextAdd: jest.fn(),
        getCurrentText: () => '',
      })
    );
    await waitFor(() => expect(result.current.asrSettings?.asrIso).toBe('und'));

    act(() => result.current.handleTranscribe());

    expect(result.current.asrLangVisible).toBe(true);
    expect(result.current.asrProgressVisible).toBe(false);
  });

  it('strips timestamp prefixes without clipping a longer digit run', async () => {
    getAsrSettings.mockResolvedValue({
      target: 'alphabet',
      language: { bcp47: 'en', languageName: 'English' },
      asrIso: 'eng',
      dialect: undefined,
    });
    const onTextAdd = jest.fn();
    const { result } = renderHook(() =>
      useTranscribeAsr({
        team: undefined,
        sharedStr: { mustBeOnline: 'online' } as never,
        tPlayer: { recognizeSpeech: 'Recognize {0}' } as never,
        showMessage: jest.fn(),
        onTextAdd,
        getCurrentText: () => '',
      })
    );
    await waitFor(() => expect(result.current.asrSettings?.asrIso).toBe('eng'));

    act(() => {
      result.current.handleAutoTranscribe('0:01.200: hello 1:02.300: world');
    });
    act(() => {
      result.current.handleAutoTranscribe('12345678901:1.2: hi');
    });

    expect(onTextAdd).toHaveBeenNthCalledWith(1, ' hello world', true);
    expect(onTextAdd).toHaveBeenNthCalledWith(2, ' 12345678901:1.2: hi', true);
  });
});
