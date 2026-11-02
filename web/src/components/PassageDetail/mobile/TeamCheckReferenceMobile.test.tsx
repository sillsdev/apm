// react-router (via real PassageDetailContext) expects TextEncoder in some Jest envs;
// keep polyfill before any module that might pull react-router.
import { TextDecoder, TextEncoder } from 'util';

Object.assign(globalThis, { TextEncoder, TextDecoder });

// Context object must be created inside the factory so it exists when the mock
// initializes (ESM hoists imports; do not rely on a pre-mock const binding).
jest.mock('../../../context/PassageDetailContext', () => {
  const R = jest.requireActual<typeof import('react')>('react');
  return {
    PassageDetailContext: R.createContext({
      state: {},
      setState: jest.fn(),
    }),
  };
});

jest.mock('../../../crud', () => {
  const { ToolSlug } = jest.requireActual(
    '../../../crud/toolSlug'
  ) as typeof import('../../../crud/toolSlug');
  return {
    ToolSlug,
    useStepTool: () => ({ tool: ToolSlug.TeamCheck }),
  };
});

jest.mock('../../../utils', () => ({
  NamedRegions: { ProjectResource: 'ProjectResource' },
  getSegments: jest.fn(() => '[]'),
}));

jest.mock('../../../crud/useFetchMediaBlob', () => ({
  BlobStatus: { FETCHED: 'FETCHED' },
  useFetchMediaBlob: () => [
    { id: '', blobStat: 'IDLE', blob: undefined },
    jest.fn(),
  ],
}));

jest.mock('../PassageDetailPlayer', () => ({
  PassageDetailPlayer: jest.fn(() => <div data-testid="passage-player" />),
}));

jest.mock('../Internalization/SelectMyResource', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="select-resource" />),
}));

jest.mock('../../../crud/useOrgDefaults', () => ({
  orgDefaultTtsVoices: 'ttsVoices',
  useOrgDefaults: () => ({ getOrgDefault: () => undefined }),
}));
jest.mock('../../../utils/storedCompareKey', () => ({
  storedCompareKey: () => ({
    removeStoredKeys: jest.fn(),
    saveKey: jest.fn(),
    storeKey: () => 'compare-store-key',
    SecSlug: 'SecSlug',
  }),
}));

// TT-7819: the Reference Text parts Compare reuses from Internalize
const mockPassages: Record<string, unknown> = {};
// Each rank's Reference Text is a stand-in whose id is the rank
jest.mock('../../../business/referenceText/useReferenceTextPassage', () => ({
  useProjectReferenceTexts: () => [{ id: 'primary' }, { id: 'secondary' }],
  useReferenceTextPassage: (_p: unknown, referenceText: { id: string }) =>
    mockPassages[referenceText.id] ?? { status: 'none' },
}));
jest.mock('../../../business/referenceText/speakReferenceText', () => ({
  speakReferenceText: jest.fn(),
}));
jest.mock('../Internalization/usePassageRef', () => ({
  usePassageRef: () => ({ passageRef: () => 'John 3:16' }),
}));
jest.mock('../../StepEditor', () => ({
  LightTooltip: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../../hoc/BigDialog', () => ({
  __esModule: true,
  default: ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <div role="dialog" aria-label={title}>
      {children}
    </div>
  ),
}));
jest.mock('../../../selector', () => ({
  vProjectSelector: () => ({
    primaryReferenceText: 'Primary Reference Text',
    secondaryReferenceText: 'Secondary Reference Text',
    licenseNotStated: 'License not stated',
  }),
  passageDetailArtifactsSelector: () => ({
    referenceTextLoading: 'Loading passage…',
    referenceTextNoVoice: 'No voice for {0} on this device.',
    referenceTextSpeakFailed: 'The passage could not be spoken.',
  }),
  sharedSelector: () => ({ close: 'Close' }),
  mediaActionsSelector: () => ({ play: 'Play', stop: 'Stop', view: 'View' }),
}));
jest.mock('react-redux', () => ({
  shallowEqual: jest.fn(),
  useSelector: (sel: (s: unknown) => unknown) =>
    sel({ strings: { lang: 'en' } }),
}));

import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- JSX (react-jsx) still expects React in scope for TS in this file
import React from 'react';
import { PassageDetailContext } from '../../../context/PassageDetailContext';
import { TeamCheckReferenceMobile } from './TeamCheckReferenceMobile';
import { PassageDetailPlayer } from '../PassageDetailPlayer';
import SelectMyResource from '../Internalization/SelectMyResource';
import { speakReferenceText } from '../../../business/referenceText/speakReferenceText';

const mockSpeak = speakReferenceText as jest.Mock;
const bsb = {
  id: 'BSB',
  name: 'Berean Standard Bible',
  englishName: 'Berean Standard Bible',
  language: 'eng',
  textDirection: 'ltr',
  license: '',
  books: 'JHN',
};

const PassageDetailPlayerMock =
  PassageDetailPlayer as unknown as jest.MockedFunction<
    typeof PassageDetailPlayer
  >;
const SelectMyResourceMock = SelectMyResource as unknown as jest.Mock;

const resourceRow = {
  id: 'resource-1',
  mediafile: {
    id: 'mf-resource-1',
    attributes: { segments: '{}', transcription: 'resource text' },
  },
};

function buildState(overrides: Record<string, unknown> = {}) {
  return {
    rowData: [],
    setPlayItem: jest.fn(),
    setMediaSelected: jest.fn(),
    playing: false,
    setPlaying: jest.fn(),
    // Speaking a Reference Text stops other passage playback
    setItemPlaying: jest.fn(),
    setCommentPlaying: jest.fn(),
    handleOldVernacularPlayEnd: jest.fn(),
    section: { id: 'section-1' },
    passage: { id: 'passage-1' },
    currentstep: 'compare-step',
    ...overrides,
  };
}

function renderWithContext(stateOverrides?: Record<string, unknown>) {
  const state = buildState(stateOverrides);
  return render(
    <PassageDetailContext.Provider
      value={{ state: state as never, setState: jest.fn() }}
    >
      <TeamCheckReferenceMobile width={400} />
    </PassageDetailContext.Provider>
  );
}

type BottomPlayerProps = {
  allowZoomAndSpeed?: boolean;
  showTranscriptionButton?: boolean;
  playerState: {
    playing: boolean;
    setPlaying: (b: boolean) => void;
  };
};

function lastBottomPassageDetailPlayerProps() {
  const bottoms = PassageDetailPlayerMock.mock.calls
    .map((c) => c[0] as Partial<BottomPlayerProps>)
    .filter((p) => p.playerState != null);
  const last = bottoms[bottoms.length - 1];
  expect(last?.playerState).toBeDefined();
  return last as BottomPlayerProps;
}

function lastSelectMyResourceProps() {
  const calls = SelectMyResourceMock.mock.calls;
  const last = calls[calls.length - 1]?.[0] as {
    disabled?: boolean;
    onChange?: (id: string) => void;
  };
  expect(last).toBeDefined();
  return last;
}

/** Select a compare resource so the bottom PassageDetailPlayer mounts. */
function selectResource(resourceId = resourceRow.id) {
  const { onChange } = lastSelectMyResourceProps();
  expect(onChange).toBeDefined();
  act(() => {
    onChange!(resourceId);
  });
}

describe('TeamCheckReferenceMobile', () => {
  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();
    PassageDetailPlayerMock.mockClear();
    localStorage.clear();
    delete mockPassages.primary;
    mockSpeak.mockReturnValue({
      done: new Promise(() => undefined),
      stop: jest.fn(),
    });
    global.ResizeObserver = class {
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    };
  });

  it('does not render PassageDetailChooser passage tabs on mobile Compare', () => {
    renderWithContext();
    // Matches PassageDetailChooser.tsx (Mui Tabs aria-label); unique in the app.
    expect(
      screen.queryByRole('tablist', { name: 'scrollable passage tabs' })
    ).not.toBeInTheDocument();
  });

  it('renders vernacular player and reference resource selector', () => {
    renderWithContext();
    // TT-7709: no resource player until a resource is selected
    expect(screen.getAllByTestId('passage-player')).toHaveLength(1);
    expect(screen.getByTestId('select-resource')).toBeInTheDocument();
  });

  it('TT-7709: before resource selection, does not mount the bottom player', () => {
    renderWithContext({ rowData: [resourceRow] });

    expect(screen.getAllByTestId('passage-player')).toHaveLength(1);
    const bottoms = PassageDetailPlayerMock.mock.calls.filter(
      (c) => (c[0] as { playerState?: unknown }).playerState != null
    );
    expect(bottoms).toHaveLength(0);
  });

  it('TT-7709: after resource selection, bottom player has no speed or eye', async () => {
    renderWithContext({ rowData: [resourceRow] });

    selectResource();

    await waitFor(() => {
      expect(screen.getAllByTestId('passage-player')).toHaveLength(2);
    });

    const bottom = lastBottomPassageDetailPlayerProps();
    expect(bottom.allowZoomAndSpeed).toBe(false);
    expect(bottom.showTranscriptionButton).toBe(false);
  });

  it('TT-7005: leaves the mobile resource selector enabled when idle', () => {
    renderWithContext();

    expect(lastSelectMyResourceProps().disabled).toBe(false);
  });

  it('TT-7005: disables the mobile resource selector while the bottom (reference) player is playing', async () => {
    renderWithContext({ rowData: [resourceRow] });
    selectResource();

    await waitFor(() => {
      expect(lastBottomPassageDetailPlayerProps().playerState).toBeDefined();
    });

    lastBottomPassageDetailPlayerProps().playerState.setPlaying(true);

    await waitFor(() => {
      expect(lastBottomPassageDetailPlayerProps().playerState.playing).toBe(
        true
      );
    });
    expect(lastSelectMyResourceProps().disabled).toBe(true);
  });

  it('stops the top player when bottom player starts (TT-7280)', async () => {
    const setTopPlaying = jest.fn();
    renderWithContext({
      playing: true,
      setPlaying: setTopPlaying,
      rowData: [resourceRow],
    });

    selectResource();

    await waitFor(() => {
      expect(lastBottomPassageDetailPlayerProps().playerState).toBeDefined();
    });

    lastBottomPassageDetailPlayerProps().playerState.setPlaying(true);

    expect(setTopPlaying).toHaveBeenCalledWith(false);
  });

  it('stops the bottom player when top (vernacular) becomes playing (TT-7280)', async () => {
    const setTopPlaying = jest.fn();
    const idleTopState = buildState({
      playing: false,
      setPlaying: setTopPlaying,
      rowData: [resourceRow],
    });

    const { rerender } = render(
      <PassageDetailContext.Provider
        value={{ state: idleTopState as never, setState: jest.fn() }}
      >
        <TeamCheckReferenceMobile width={400} />
      </PassageDetailContext.Provider>
    );

    selectResource();

    await waitFor(() => {
      expect(lastBottomPassageDetailPlayerProps().playerState).toBeDefined();
    });
    lastBottomPassageDetailPlayerProps().playerState.setPlaying(true);

    await waitFor(() => {
      expect(lastBottomPassageDetailPlayerProps().playerState.playing).toBe(
        true
      );
    });

    const topPlayingState = buildState({
      playing: true,
      setPlaying: setTopPlaying,
      rowData: [resourceRow],
    });

    rerender(
      <PassageDetailContext.Provider
        value={{ state: topPlayingState as never, setState: jest.fn() }}
      >
        <TeamCheckReferenceMobile width={400} />
      </PassageDetailContext.Provider>
    );

    await waitFor(() => {
      expect(lastBottomPassageDetailPlayerProps().playerState.playing).toBe(
        false
      );
    });
  });

  // TT-7819: a Reference Text picked on mobile Compare is spoken, so it gets
  // Play and View instead of a second media player.
  it('TT-7819: speaks the Primary Reference Text picked as the resource', () => {
    mockPassages.primary = {
      status: 'ready',
      referenceText: bsb,
      text: 'For God so loved',
    };
    renderWithContext({ rowData: [resourceRow] });

    selectResource('referenceText:primary');

    expect(screen.getAllByTestId('passage-player')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(mockSpeak).toHaveBeenCalledWith(
      bsb,
      'For God so loved',
      expect.any(Function),
      {}
    );
  });
});
