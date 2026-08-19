/**
 * TT-7553: reopening Phrase Back Translate step settings after a language was
 * saved must not thrash parent toolSettings via Language's mount/sync onChange.
 * TT-7555: artifact type is not choosable here (no Community Test Retell dropdown).
 * TT-7583: the artifact type written to settings must be the remote id.
 */

/** Swapped per test; read lazily by the useGlobal mock below. */
let mockKeyMap:
  | { idToKey: (...args: string[]) => string | undefined }
  | undefined;
jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  shallowEqual: jest.fn(),
}));

jest.mock('../../selector', () => ({
  stepEditorSelector: (state: { stepEditor: unknown }) => state.stepEditor,
  artifactTypeSelector: () => ({ artifactType: 'Artifact Type' }),
}));

jest.mock('../../context/useGlobal', () => ({
  useGlobal: jest.fn(() => [{ keyMap: mockKeyMap }, jest.fn()]),
}));

jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: jest.fn(() => []),
}));

jest.mock('../../crud', () => ({
  ArtifactTypeSlug: jest.requireActual('../../crud/artifactTypeSlug')
    .ArtifactTypeSlug,
  useArtifactType: () => ({
    getTypeId: (slug: string) => `type-${slug}`,
    getArtifactTypes: () => [
      { id: 'type-phraseBackTranslation', type: 'Phrase Back Translation' },
      { id: 'type-retell', type: 'Community Test' },
    ],
  }),
}));

jest.mock('../../crud/transcribeStepAsrSettings', () => ({
  formatStepLanguageField: (lang: { languageName?: string; bcp47?: string }) =>
    `${lang.languageName ?? ''}|${lang.bcp47 ?? 'und'}`,
  parseStepLanguageField: (value: unknown) => {
    if (value == null || value === '') {
      return { languageName: '', bcp47: 'und' };
    }
    const str = String(value);
    const pipe = str.indexOf('|');
    if (pipe === -1) return { languageName: '', bcp47: str || 'und' };
    return {
      languageName: str.slice(0, pipe),
      bcp47: str.slice(pipe + 1) || 'und',
    };
  },
}));

jest.mock('./isDuplicatePhraseBtLanguage', () => ({
  isDuplicatePhraseBtLanguage: () => false,
}));

jest.mock('../Sheet/SelectArtifactType', () => ({
  __esModule: true,
  default: () => <div data-testid="select-artifact-type" />,
}));

/** Mirrors Language.tsx: sync props → state, then echo state via onChange. */
jest.mock('../../control', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Language: (props: {
      bcp47: string;
      languageName: string;
      font?: string;
      rtl?: boolean;
      spellCheck?: boolean;
      onChange: (state: {
        bcp47: string;
        languageName: string;
        font: string;
        rtl: boolean;
        spellCheck: boolean;
      }) => void;
    }) => {
      const [state, setState] = React.useState({
        bcp47: props.bcp47,
        languageName: props.languageName,
        font: props.font ?? '',
        rtl: props.rtl ?? false,
        spellCheck: props.spellCheck ?? false,
      });
      const stateRef = React.useRef<typeof state | undefined>(undefined);

      React.useEffect(() => {
        setState((prev) => {
          if (
            prev.bcp47 === props.bcp47 &&
            prev.languageName === props.languageName
          ) {
            return prev;
          }
          return {
            ...prev,
            bcp47: props.bcp47,
            languageName: props.languageName,
          };
        });
      }, [props.bcp47, props.languageName]);

      React.useEffect(() => {
        if (stateRef.current !== state) {
          props.onChange(state);
          stateRef.current = state;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [state, props.onChange]);

      return React.createElement(
        'div',
        { 'data-testid': 'language-mock' },
        React.createElement(
          'button',
          {
            type: 'button',
            'data-testid': 'pick-english',
            onClick: () =>
              setState({
                bcp47: 'en',
                languageName: 'English',
                font: '',
                rtl: false,
                spellCheck: false,
              }),
          },
          'pick-english'
        )
      );
    },
  };
});

import { useState } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSelector } from 'react-redux';
import { PhraseBackTranslateStepSettings } from './PhraseBackTranslateStepSettings';

const mockUseSelector = useSelector as unknown as jest.Mock;

const savedSettings = JSON.stringify({
  artifactTypeId: 'type-phraseBackTranslation',
  language: 'Tamil|ta',
});

const savedRetellSettings = JSON.stringify({
  artifactTypeId: 'type-retell',
  language: 'Kom|bkm',
});

function ReopenHarness({
  onChangeSpy,
  initialSettings = savedSettings,
}: {
  onChangeSpy: jest.Mock<(settings: string) => void>;
  initialSettings?: string;
}) {
  const [settings, setSettings] = useState(initialSettings);
  return (
    <PhraseBackTranslateStepSettings
      toolSettings={settings}
      onChange={(next) => {
        onChangeSpy(next);
        setSettings(next);
      }}
      stepId="step-1"
    />
  );
}

describe('PhraseBackTranslateStepSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockKeyMap = undefined;
    mockUseSelector.mockImplementation(
      (sel: (state: { stepEditor: Record<string, string> }) => unknown) =>
        sel({
          stepEditor: {
            languageRequired: 'Language is required',
            duplicatePhraseBtLanguage: 'Duplicate language',
          },
        })
    );
  });

  it('does not show an artifact type dropdown (TT-7555)', () => {
    render(
      <PhraseBackTranslateStepSettings
        toolSettings={savedSettings}
        onChange={jest.fn()}
        stepId="step-1"
      />
    );
    expect(screen.queryByTestId('select-artifact-type')).toBeNull();
    expect(screen.getByTestId('language-mock')).toBeTruthy();
  });

  it('does not thrash toolSettings when reopening with a saved language (TT-7553)', async () => {
    const onChangeSpy = jest.fn();

    render(<ReopenHarness onChangeSpy={onChangeSpy} />);

    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="language-mock"]')
      ).toBeTruthy();
    });

    // Allow effects to settle; a reopen loop would exceed React's update depth.
    await waitFor(() => {
      const last = onChangeSpy.mock.calls.at(-1)?.[0] as string | undefined;
      if (last) {
        const parsed = JSON.parse(last) as { language?: string };
        expect(parsed.language).toBe('Tamil|ta');
      }
    });

    expect(onChangeSpy.mock.calls.length).toBeLessThan(5);
    for (const [settings] of onChangeSpy.mock.calls) {
      const parsed = JSON.parse(settings) as { language?: string };
      expect(parsed.language).not.toMatch(/\|und$/);
    }
  });

  it('emits when the user picks a different language', async () => {
    const onChangeSpy = jest.fn();
    render(<ReopenHarness onChangeSpy={onChangeSpy} />);

    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="language-mock"]')
      ).toBeTruthy();
    });
    onChangeSpy.mockClear();

    fireEvent.click(screen.getByTestId('pick-english'));

    await waitFor(() => {
      expect(onChangeSpy).toHaveBeenCalled();
      const last = onChangeSpy.mock.calls.at(-1)?.[0] as string;
      expect(JSON.parse(last).language).toBe('English|en');
    });
  });

  it('preserves Retell artifact type when changing language (TT-7555)', async () => {
    const onChangeSpy = jest.fn();
    render(
      <ReopenHarness
        onChangeSpy={onChangeSpy}
        initialSettings={savedRetellSettings}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('language-mock')).toBeTruthy();
    });
    onChangeSpy.mockClear();

    fireEvent.click(screen.getByTestId('pick-english'));

    await waitFor(() => {
      expect(onChangeSpy).toHaveBeenCalled();
      const last = JSON.parse(onChangeSpy.mock.calls.at(-1)?.[0] as string) as {
        artifactTypeId?: string;
        language?: string;
      };
      expect(last.artifactTypeId).toBe('type-retell');
      expect(last.language).toBe('English|en');
    });
  });

  it('seeds a new step with the remote artifact type id, not the local one (TT-7583)', async () => {
    // getTypeId is mocked as `type-${slug}`; PhraseBackTranslation is
    // 'backtranslation'.
    mockKeyMap = {
      idToKey: (table: string, key: string, localId: string) =>
        table === 'artifacttype' &&
        key === 'remoteId' &&
        localId === 'type-backtranslation'
          ? '77'
          : undefined,
    };
    const onChangeSpy = jest.fn();
    render(<ReopenHarness onChangeSpy={onChangeSpy} initialSettings="" />);

    await waitFor(() => {
      expect(screen.getByTestId('language-mock')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('pick-english'));

    await waitFor(() => {
      expect(onChangeSpy).toHaveBeenCalled();
      const last = JSON.parse(onChangeSpy.mock.calls.at(-1)?.[0] as string) as {
        artifactTypeId?: string;
        language?: string;
      };
      expect(last.artifactTypeId).toBe('77');
      expect(last.language).toBe('English|en');
    });
  });

  it('keeps the local artifact type id when there is no remote mapping (offline)', async () => {
    mockKeyMap = { idToKey: () => undefined };
    const onChangeSpy = jest.fn();
    render(<ReopenHarness onChangeSpy={onChangeSpy} initialSettings="" />);

    await waitFor(() => {
      expect(screen.getByTestId('language-mock')).toBeTruthy();
    });

    fireEvent.click(screen.getByTestId('pick-english'));

    await waitFor(() => {
      expect(onChangeSpy).toHaveBeenCalled();
      const last = JSON.parse(onChangeSpy.mock.calls.at(-1)?.[0] as string) as {
        artifactTypeId?: string;
      };
      expect(last.artifactTypeId).toBe('type-backtranslation');
    });
  });
});
