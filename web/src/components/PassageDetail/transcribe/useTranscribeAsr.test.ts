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

  const renderAsr = () =>
    renderHook(() =>
      useTranscribeAsr({
        team: undefined,
        sharedStr: { mustBeOnline: 'online' } as never,
        tPlayer: { recognizeSpeech: 'Recognize {0}' } as never,
        showMessage: jest.fn(),
        onTextAdd: jest.fn(),
        getCurrentText: () => '',
      })
    );

  it('says the settings are loading, then ready', async () => {
    let finish: (v: unknown) => void = () => undefined;
    getAsrSettings.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        })
    );
    const { result } = renderAsr();
    expect(result.current.asrStatus).toBe('loading');
    expect(result.current.asrSettings).toBeUndefined();

    await act(async () => finish({ asrIso: 'eng', language: { bcp47: 'en' } }));

    expect(result.current.asrStatus).toBe('ready');
    expect(result.current.asrSettings).toEqual(
      expect.objectContaining({ asrIso: 'eng' })
    );
  });

  it('tells a failed load apart from loading', async () => {
    getAsrSettings.mockRejectedValue(new Error('languages failed'));
    const { result } = renderAsr();
    await waitFor(() => expect(result.current.asrStatus).toBe('failed'));
    expect(result.current.asrSettings).toBeUndefined();
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

  it('forwards cleaned ASR text through onTextAdd', async () => {
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
      result.current.handleAutoTranscribe('0:01.200: hello');
    });

    expect(onTextAdd).toHaveBeenCalledWith(' hello', 'end');
  });

  // TT-7856: a result applied onto text the user already has asks first, so a
  // second run (e.g. with another method) never silently duplicates or wipes.
  describe('applying a result onto existing text', () => {
    const saved = {
      target: 'alphabet',
      language: { bcp47: 'en', languageName: 'English' },
      asrIso: 'eng',
      asrMethod: 'mms',
      dialect: undefined,
      selectRoman: false,
    };

    const renderWith = async (current: string, hasActiveTask = false) => {
      getAsrSettings.mockResolvedValue(saved);
      const onTextAdd = jest.fn();
      const hook = renderHook(() =>
        useTranscribeAsr({
          team: undefined,
          sharedStr: { mustBeOnline: 'online' } as never,
          tPlayer: { recognizeSpeech: 'Recognize {0}' } as never,
          showMessage: jest.fn(),
          onTextAdd,
          getCurrentText: () => current,
          hasActiveTask,
        })
      );
      await waitFor(() =>
        expect(hook.result.current.asrSettings?.asrIso).toBe('eng')
      );
      return { ...hook, onTextAdd };
    };

    it('adds without asking when the pane has only a verse marker', async () => {
      const { result, onTextAdd } = await renderWith('\\v 1 ');

      act(() => result.current.handleAutoTranscribe('\\v 1 new result'));

      expect(result.current.pendingAsr).toBeUndefined();
      expect(onTextAdd).toHaveBeenCalledWith('new result', 'end');
    });

    it('asks before adding when the pane has text', async () => {
      const { result, onTextAdd } = await renderWith('\\v 1 old words');

      act(() => result.current.handleAutoTranscribe('\\v 1 new result'));

      expect(result.current.pendingAsr).toBeDefined();
      expect(onTextAdd).not.toHaveBeenCalled();
    });

    it('replaces with the whole result when the user picks Replace', async () => {
      const { result, onTextAdd } = await renderWith('\\v 1 old words');

      act(() =>
        result.current.handleAutoTranscribe('\\v 1 one \\v 2 two', '\\v 2 two')
      );
      act(() => result.current.confirmAsrReplace());

      expect(onTextAdd).toHaveBeenCalledWith('\\v 1 one \\v 2 two', 'replace');
      expect(result.current.pendingAsr).toBeUndefined();
    });

    it('inserts only unfilled verses at the caret when the user picks Insert', async () => {
      const { result, onTextAdd } = await renderWith('\\v 1 old words');

      act(() =>
        result.current.handleAutoTranscribe('\\v 1 one \\v 2 two', '\\v 2 two')
      );
      act(() => result.current.confirmAsrInsert());

      expect(onTextAdd).toHaveBeenCalledWith('\\v 2 two', 'cursor');
      expect(result.current.pendingAsr).toBeUndefined();
    });

    it('adds nothing on Insert when every verse already has text', async () => {
      const { result, onTextAdd } = await renderWith('\\v 1 old words');

      act(() => result.current.handleAutoTranscribe('\\v 1 one', ''));
      act(() => result.current.confirmAsrInsert());

      expect(onTextAdd).not.toHaveBeenCalled();
    });

    it('does not ask when the result is already in the pane', async () => {
      const { result, onTextAdd } = await renderWith('\\v 1 same words');

      act(() => result.current.handleAutoTranscribe('\\v 1 same words'));

      expect(result.current.pendingAsr).toBeUndefined();
      expect(onTextAdd).not.toHaveBeenCalled();
    });

    it('asks for a changed-method run resumed after its progress box closed', async () => {
      const { result, onTextAdd } = await renderWith(
        '\\v 1 whisper words',
        true
      );

      act(() => result.current.openAsrLanguageSettings());
      act(() =>
        result.current.handleAsrLanguageClose(false, {
          ...saved,
          asrMethod: 'whisper',
        } as never)
      );
      act(() => result.current.setAsrProgressVisible(false));
      act(() => result.current.handleTranscribe());
      act(() => result.current.handleAutoTranscribe('\\v 1 mms words'));

      expect(result.current.pendingAsr).toBeDefined();
      expect(onTextAdd).not.toHaveBeenCalled();
    });
  });

  it('derives phonetic from the active ASR target', async () => {
    getAsrSettings.mockResolvedValue({
      target: 'Phonetic',
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
    expect(result.current.phonetic).toBe(true);

    act(() => result.current.handleTranscribe());

    expect(result.current.asrOverride?.target).toBe('Phonetic');
    expect(result.current.phonetic).toBe(true);
  });

  it('forces a new run when settings change in the language dialog', async () => {
    const saved = {
      target: 'alphabet',
      language: { bcp47: 'en', languageName: 'English' },
      asrIso: 'eng',
      asrMethod: 'mms',
      dialect: undefined,
      selectRoman: false,
    };
    getAsrSettings.mockResolvedValue(saved);
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
    await waitFor(() => expect(result.current.asrSettings?.asrIso).toBe('eng'));

    act(() => result.current.openAsrLanguageSettings());
    act(() =>
      result.current.handleAsrLanguageClose(false, {
        ...saved,
        asrMethod: 'whisper',
      } as never)
    );

    expect(result.current.forceAsr).toBe(true);
    expect(result.current.asrProgressVisible).toBe(true);
  });

  it('does not force when the language dialog saves the same settings', async () => {
    const saved = {
      target: 'alphabet',
      language: { bcp47: 'en', languageName: 'English' },
      asrIso: 'eng',
      asrMethod: 'mms',
      dialect: undefined,
      selectRoman: false,
    };
    getAsrSettings.mockResolvedValue(saved);
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
    await waitFor(() => expect(result.current.asrSettings?.asrIso).toBe('eng'));

    act(() => result.current.openAsrLanguageSettings());
    act(() =>
      result.current.handleAsrLanguageClose(false, { ...saved } as never)
    );

    expect(result.current.forceAsr).toBe(false);
  });
});
