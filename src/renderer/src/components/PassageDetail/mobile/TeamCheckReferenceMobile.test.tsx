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
  default: () => <div data-testid="select-resource" />,
}));

jest.mock('../../../utils/storedCompareKey', () => ({
  storedCompareKey: () => ({
    removeStoredKeys: jest.fn(),
    saveKey: jest.fn(),
    storeKey: () => 'compare-store-key',
    SecSlug: 'SecSlug',
  }),
}));

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- JSX (react-jsx) still expects React in scope for TS in this file
import React from 'react';
import { PassageDetailContext } from '../../../context/PassageDetailContext';
import { TeamCheckReferenceMobile } from './TeamCheckReferenceMobile';
import { PassageDetailPlayer } from '../PassageDetailPlayer';

const PassageDetailPlayerMock =
  PassageDetailPlayer as unknown as jest.MockedFunction<
    typeof PassageDetailPlayer
  >;

function buildState(overrides: Record<string, unknown> = {}) {
  return {
    rowData: [],
    setPlayItem: jest.fn(),
    setMediaSelected: jest.fn(),
    playing: false,
    setPlaying: jest.fn(),
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

function lastBottomPassageDetailPlayerProps() {
  const bottoms = PassageDetailPlayerMock.mock.calls
    .map((c) => c[0] as { playerState?: { playing: boolean } })
    .filter((p) => p.playerState != null);
  const last = bottoms[bottoms.length - 1];
  expect(last?.playerState).toBeDefined();
  return last as { playerState: { playing: boolean } };
}

describe('TeamCheckReferenceMobile', () => {
  beforeEach(() => {
    cleanup();
    jest.clearAllMocks();
    PassageDetailPlayerMock.mockClear();
    global.localStorage.getItem = jest.fn(() => null);
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
    expect(screen.getAllByTestId('passage-player')).toHaveLength(2);
    expect(screen.getByTestId('select-resource')).toBeInTheDocument();
  });

  it('stops the top player when bottom player starts (TT-7280)', () => {
    const setTopPlaying = jest.fn();
    renderWithContext({
      playing: true,
      setPlaying: setTopPlaying,
    });

    expect(PassageDetailPlayerMock).toHaveBeenCalled();
    const calls = PassageDetailPlayerMock.mock.calls;
    expect(calls.length).toBeGreaterThanOrEqual(2);

    const bottomProps = calls[1][0];
    expect(bottomProps.playerState).toBeDefined();
    bottomProps.playerState!.setPlaying(true);

    expect(setTopPlaying).toHaveBeenCalledWith(false);
  });

  it('stops the bottom player when top (vernacular) becomes playing (TT-7280)', async () => {
    const setTopPlaying = jest.fn();
    const idleTopState = buildState({
      playing: false,
      setPlaying: setTopPlaying,
    });

    const { rerender } = render(
      <PassageDetailContext.Provider
        value={{ state: idleTopState as never, setState: jest.fn() }}
      >
        <TeamCheckReferenceMobile width={400} />
      </PassageDetailContext.Provider>
    );

    const initialCalls = PassageDetailPlayerMock.mock.calls;
    expect(initialCalls.length).toBeGreaterThanOrEqual(2);
    const bottomProps = initialCalls[1][0] as {
      playerState?: { playing: boolean; setPlaying: (b: boolean) => void };
    };
    expect(bottomProps.playerState).toBeDefined();
    bottomProps.playerState!.setPlaying(true);

    await waitFor(() => {
      expect(lastBottomPassageDetailPlayerProps().playerState.playing).toBe(
        true
      );
    });

    const topPlayingState = buildState({
      playing: true,
      setPlaying: setTopPlaying,
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
});
