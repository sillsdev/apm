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
import { applyAsrText, type AsrTextMode } from './insertAsrText';

const asrResult = (full: string) => ({ full });

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
      result.current.handleAutoTranscribe(asrResult('0:01.200: hello'));
    });

    expect(onTextAdd).toHaveBeenCalledWith('hello', 'end');
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
      const hook = renderHook(
        ({ mediaId }: { mediaId: string }) =>
          useTranscribeAsr({
            team: undefined,
            sharedStr: { mustBeOnline: 'online' } as never,
            tPlayer: { recognizeSpeech: 'Recognize {0}' } as never,
            showMessage: jest.fn(),
            onTextAdd,
            getCurrentText: () => current,
            hasActiveTask,
            mediaId,
          }),
        { initialProps: { mediaId: 'm1' } }
      );
      await waitFor(() =>
        expect(hook.result.current.asrSettings?.asrIso).toBe('eng')
      );
      return { ...hook, onTextAdd };
    };

    it('adds without asking when the pane has only a verse marker', async () => {
      const { result, onTextAdd } = await renderWith('\\v 1 ');

      act(() =>
        result.current.handleAutoTranscribe(asrResult('\\v 1 new result'))
      );

      expect(result.current.asrPrompt).toBeUndefined();
      expect(onTextAdd).toHaveBeenCalledWith('\\v 1 new result', 'end');
    });

    it('adds without asking when the pane has only a suffixed verse marker', async () => {
      const { result, onTextAdd } = await renderWith('\\v 1-5a ');

      act(() =>
        result.current.handleAutoTranscribe(asrResult('\\v 1-5a New words'))
      );

      expect(result.current.asrPrompt).toBeUndefined();
      expect(onTextAdd).toHaveBeenCalledWith('\\v 1-5a New words', 'end');
    });

    // The pane as the editor holds it: onTextAdd edits it the way the desktop
    // and mobile editors do, with the caret at the end.
    const renderPane = async (start: string) => {
      getAsrSettings.mockResolvedValue(saved);
      const pane = { text: start };
      const onTextAdd = jest.fn((text: string, mode: AsrTextMode) => {
        const at = pane.text.length;
        pane.text = applyAsrText(pane.text, text, mode, {
          start: at,
          end: at,
        }).value;
      });
      const hook = renderHook(() =>
        useTranscribeAsr({
          team: undefined,
          sharedStr: { mustBeOnline: 'online' } as never,
          tPlayer: { recognizeSpeech: 'Recognize {0}' } as never,
          showMessage: jest.fn(),
          onTextAdd,
          getCurrentText: () => pane.text,
          mediaId: 'm1',
        })
      );
      await waitFor(() =>
        expect(hook.result.current.asrSettings?.asrIso).toBe('eng')
      );
      return { ...hook, pane };
    };

    it('puts each verse after its own marker in a pane of empty markers', async () => {
      const { result, pane } = await renderPane('\\v 1a\n\\v 2');

      act(() =>
        result.current.handleAutoTranscribe(asrResult('\\v 1a one \\v 2 two'))
      );

      expect(result.current.asrPrompt).toBeUndefined();
      expect(pane.text).toBe('\\v 1a one\n\\v 2 two');
    });

    describe('Insert on a result offered again after a dismiss', () => {
      const dismissedOn = async (start: string) => {
        const hook = await renderPane(start);
        act(() =>
          hook.result.current.handleAutoTranscribe(
            asrResult('\\v 1 one \\v 2 two')
          )
        );
        act(() => hook.result.current.asrPrompt?.onDismiss());
        return hook;
      };

      it('leaves out a verse filled by hand after the dismiss', async () => {
        const { result, pane } = await dismissedOn('\\v 1 old \\v 2 ');

        pane.text = '\\v 1 old \\v 2 typed';
        act(() => result.current.handleTranscribe());
        act(() => result.current.asrPrompt?.onInsert());

        expect(pane.text).toBe('\\v 1 old \\v 2 typed');
      });

      it('adds a verse emptied by hand after the dismiss', async () => {
        const { result, pane } = await dismissedOn('\\v 1 old \\v 2 ');

        pane.text = '\\v 1 \\v 2 kept';
        act(() => result.current.handleTranscribe());
        act(() => result.current.asrPrompt?.onInsert());

        expect(pane.text).toBe('\\v 1 one \\v 2 kept');
      });
    });

    describe('dismissing the prompt', () => {
      const dismissed = async (current = '\\v 1 old words') => {
        const hook = await renderWith(current);
        act(() =>
          hook.result.current.handleAutoTranscribe(
            asrResult('\\v 1 new result')
          )
        );
        act(() => hook.result.current.asrPrompt?.onDismiss());
        return hook;
      };

      it('leaves the pane as it was', async () => {
        const { result, onTextAdd } = await dismissed();

        expect(onTextAdd).not.toHaveBeenCalled();
        expect(result.current.asrPrompt).toBeUndefined();
      });

      it('offers the same result again without a new run', async () => {
        const { result } = await dismissed();

        act(() => result.current.handleTranscribe());

        expect(result.current.asrProgressVisible).toBe(false);
        expect(result.current.asrPrompt?.result.full).toBe('\\v 1 new result');
      });

      it('offers it only once it is chosen', async () => {
        const { result, onTextAdd } = await dismissed();

        act(() => result.current.handleTranscribe());
        act(() => result.current.asrPrompt?.onReplace());
        act(() => result.current.handleTranscribe());

        expect(onTextAdd).toHaveBeenCalledTimes(1);
        expect(result.current.asrProgressVisible).toBe(true);
      });

      it('runs again on another recording', async () => {
        const { result, rerender } = await dismissed();

        rerender({ mediaId: 'm2' });
        act(() => result.current.handleTranscribe());

        expect(result.current.asrProgressVisible).toBe(true);
        expect(result.current.asrPrompt).toBeUndefined();
      });

      it('runs again when the method is changed', async () => {
        const { result } = await dismissed();

        act(() => result.current.openAsrLanguageSettings());
        act(() =>
          result.current.handleAsrLanguageClose(false, {
            ...saved,
            asrMethod: 'whisper',
          } as never)
        );

        expect(result.current.forceAsr).toBe(true);
        expect(result.current.asrProgressVisible).toBe(true);
        expect(result.current.asrPrompt).toBeUndefined();
      });
    });

    it('asks before adding when the pane has text', async () => {
      const { result, onTextAdd } = await renderWith('\\v 1 old words');

      act(() =>
        result.current.handleAutoTranscribe(asrResult('\\v 1 new result'))
      );

      expect(result.current.asrPrompt).toBeDefined();
      expect(onTextAdd).not.toHaveBeenCalled();
    });

    it('replaces with the whole result when the user picks Replace', async () => {
      const { result, onTextAdd } = await renderWith('\\v 1 old words');

      act(() =>
        result.current.handleAutoTranscribe(asrResult('\\v 1 one \\v 2 two'))
      );
      act(() => result.current.asrPrompt?.onReplace());

      expect(onTextAdd).toHaveBeenCalledWith('\\v 1 one \\v 2 two', 'replace');
      expect(result.current.asrPrompt).toBeUndefined();
    });

    it('inserts only unfilled verses at the caret when the user picks Insert', async () => {
      const { result, onTextAdd } = await renderWith('\\v 1 old words');

      act(() =>
        result.current.handleAutoTranscribe(asrResult('\\v 1 one \\v 2 two'))
      );
      act(() => result.current.asrPrompt?.onInsert());

      expect(onTextAdd).toHaveBeenCalledWith('\\v 2 two', 'cursor');
      expect(result.current.asrPrompt).toBeUndefined();
    });

    it('adds nothing on Insert when every verse already has text', async () => {
      const { result, onTextAdd } = await renderWith('\\v 1 old words');

      act(() => result.current.handleAutoTranscribe(asrResult('\\v 1 one')));
      act(() => result.current.asrPrompt?.onInsert());

      expect(onTextAdd).not.toHaveBeenCalled();
    });

    it('does not ask when the result is already in the pane', async () => {
      const { result, onTextAdd } = await renderWith('\\v 1 same words');

      act(() =>
        result.current.handleAutoTranscribe(asrResult('\\v 1 same words'))
      );

      expect(result.current.asrPrompt).toBeUndefined();
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
      act(() =>
        result.current.handleAutoTranscribe(asrResult('\\v 1 mms words'))
      );

      expect(result.current.asrPrompt).toBeDefined();
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
