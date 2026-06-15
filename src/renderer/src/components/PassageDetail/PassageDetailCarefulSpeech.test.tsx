import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { IRegion } from '../../crud/useWavesurferRegions';
import { CLAUSE_BOUNDARY_THRESHOLD_SEC } from './carefulSpeech/carefulSpeechBoundary';

/**
 * Behavioural spec for the Careful Speech orchestration (TT-7360).
 *
 * The real player (PassageDetailPlayer -> WSAudioPlayer/MediaRecord) drives the
 * region events that this component reacts to. We mock the player so we can:
 *   - hand the component a controllable `controlsRef` (isReady/gotoTime/setPlay),
 *   - fire `onSegmentPlaybackEnd` to simulate a clause finishing playback,
 *   - simulate the engine moving the "current segment" (tap or overshoot).
 *
 * CarefulSpeechControls is mocked so we can assert the props the parent feeds it
 * (phase, recordingPassStarted, allowRecord, allClausesComplete).
 */

// ---- 8 clause regions, 10s each ---------------------------------------------
const regions: IRegion[] = Array.from({ length: 8 }, (_, i) => ({
  start: i * 10,
  end: (i + 1) * 10,
  label: '',
}));

// The component seeks to start + threshold (or 0 for the first clause) when
// positioning/playing a clause — mirror that in expectations.
const seekFor = (i: number) =>
  regions[i].start > 0 ? regions[i].start + CLAUSE_BOUNDARY_THRESHOLD_SEC : 0;

// ---- mutable test state shared with the mocks -------------------------------
let mockCompleted = new Set<number>();
let controlsProps: Record<string, unknown> | undefined;
let playerProps: Record<string, unknown> | undefined;
let confirmShown = false;
let confirmDismiss: (() => void) | undefined;
let mockStepComplete = false;
let mockRecordingRow:
  | { mediafile: { id: string; attributes?: { sourceSegments?: string } } }
  | undefined;

const mockSetStepComplete = jest.fn().mockResolvedValue(undefined);
const mockGotoNextStep = jest.fn();
const mockStepCompleteFn = jest.fn(() => mockStepComplete);
const mockWaitForSave = jest.fn().mockResolvedValue(undefined);
const mockMemoryUpdate = jest.fn().mockResolvedValue(undefined);

const stubControls = {
  isReady: jest.fn(() => true),
  isPlaying: jest.fn(() => false),
  gotoTime: jest.fn().mockResolvedValue(undefined),
  setPlay: jest.fn(),
  applyRegionColors: jest.fn(),
  loadRegionsJson: jest.fn(),
};

// The PassageDetailContext value. getCurrentSegment / currentSegmentIndex stand
// in for the wavesurfer engine's notion of the selected region.
const ctx: {
  _seg: IRegion | undefined;
  currentSegmentIndex: number;
  [k: string]: unknown;
} = {
  _seg: regions[0],
  currentSegmentIndex: 0,
  passage: { id: 'p1', type: 'passage' },
  playerMediafile: { id: 'm1', type: 'mediafile' },
  mediafileId: 'm1',
  rowData: [],
  currentstep: 'step1',
  section: { id: 's1', type: 'section' },
  setPlaying: jest.fn(),
  setRecording: jest.fn(),
  forceRefresh: jest.fn(),
  getCurrentSegment: jest.fn(() => ctx._seg),
  isBoldWorkflow: true,
  carefulSpeechSegParams: {},
  setCarefulSpeechSegParams: jest.fn(),
  setStepComplete: mockSetStepComplete,
  gotoNextStep: mockGotoNextStep,
  stepComplete: mockStepCompleteFn,
  // updating the engine segment keeps getCurrentSegment consistent with the
  // index the component believes it is on.
  setCurrentSegment: jest.fn((region: IRegion) => {
    ctx._seg = region;
    ctx.currentSegmentIndex += 1;
  }),
};

// ---- mocks ------------------------------------------------------------------
jest.mock('../../context/usePassageDetailContext', () => () => ctx);

jest.mock('./carefulSpeech/useCarefulSpeechSegments', () => ({
  useCarefulSpeechSegments: () => ({
    clauseSegString: '[]',
    setClauseSegString: jest.fn(),
    bootstrapped: true,
    ensureSegments: jest.fn().mockResolvedValue(true),
    resetForMediafile: jest.fn(),
    resegmentWithParams: jest.fn().mockResolvedValue(false),
    resetToDefaultSegments: jest.fn().mockResolvedValue(false),
    persistClauseSegments: jest.fn().mockResolvedValue(undefined),
  }),
}));

jest.mock('../../utils/namedSegments', () => {
  const actual = jest.requireActual('../../utils/namedSegments');
  return { ...actual, getSortedRegions: jest.fn(() => regions) };
});

jest.mock('./carefulSpeech/carefulSpeechCompletion', () => {
  const actual = jest.requireActual('./carefulSpeech/carefulSpeechCompletion');
  return {
    ...actual,
    getCompletedClauseIndices: jest.fn(() => mockCompleted),
    getRecordingForClause: jest.fn(() => mockRecordingRow),
  };
});

jest.mock('../../crud', () => ({
  ArtifactTypeSlug: { CarefulSpeech: 'careful-speech' },
  remoteIdGuid: jest.fn((_t: string, id: string) => id),
  useArtifactType: () => ({ getTypeId: () => 'art1' }),
  useStepTool: () => ({ settings: { artifactTypeId: 'art1' } }),
}));
jest.mock('../../crud/related', () => ({ related: () => 'p1' }));
jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({ canDoSectionStep: () => true }),
}));
jest.mock('../../utils/carefulSpeechSegmentColors', () => ({
  createCarefulSpeechApplyRegionColor: () => () => {},
}));
jest.mock('../../utils/passageDefaultFilename', () => ({
  passageDefaultFilename: () => 'file.ogg',
}));
jest.mock('../../selector', () => ({ carefulSpeechSelector: jest.fn() }));
jest.mock('react-redux', () => ({
  useSelector: () => ({
    boldOnly: 'BOLD only',
    allComplete: 'All clauses recorded',
  }),
  shallowEqual: jest.fn(),
}));
jest.mock('../../context/useGlobal', () => ({
  useGlobal: (key: string) =>
    key === 'memory'
      ? [{ keyMap: {}, update: mockMemoryUpdate }, jest.fn()]
      : [undefined, jest.fn()],
}));
jest.mock('../../context/UnsavedContext', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    UnsavedContext: ReactActual.createContext({
      state: { startSave: jest.fn(), waitForSave: mockWaitForSave },
    }),
  };
});
jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: () => [
    { id: 'm1', type: 'mediafile', attributes: { versionNumber: 1 } },
  ],
}));

jest.mock('./PassageDetailChooser', () => ({
  __esModule: true,
  default: () => <div data-testid="chooser" />,
}));

jest.mock('./PassageDetailPlayer', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    playerProps = props;
    const ref = props.controlsRef as { current: unknown } | undefined;
    if (ref) ref.current = stubControls;
    return <div data-testid="player" />;
  },
}));

jest.mock('./carefulSpeech/CarefulSpeechControls', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    controlsProps = props;
    return <div data-testid="controls" />;
  },
}));

jest.mock('../AlertDialog', () => ({
  __esModule: true,
  default: ({
    text,
    yesResponse,
  }: {
    text: string;
    yesResponse: () => void;
  }) => {
    confirmShown = true;
    confirmDismiss = yesResponse;
    return <div data-testid="confirm">{text}</div>;
  },
}));

// imported after the mocks so the component picks them up
import { PassageDetailCarefulSpeech } from './PassageDetailCarefulSpeech';

// Fire the player's region-out callback for a given clause.
const firePlaybackEnd = async (idx: number) => {
  const cb = playerProps?.onSegmentPlaybackEnd as
    | ((r: IRegion) => void)
    | undefined;
  await act(async () => {
    cb?.(regions[idx]);
  });
};

// Simulate the engine selecting a different clause (tap, or overshoot), then
// let the component's effects react.
const moveEngineToClause = async (
  idx: number,
  rerender: (ui: React.ReactElement) => void
) => {
  ctx._seg = regions[idx];
  ctx.currentSegmentIndex += 1;
  await act(async () => {
    rerender(<PassageDetailCarefulSpeech width={400} />);
  });
};

const mountAndSettle = async () => {
  const utils = render(<PassageDetailCarefulSpeech width={400} />);
  // wait for rAF -> player mount -> initial-position effect to position us
  await waitFor(() => expect(controlsProps).toBeDefined());
  await waitFor(() => expect(stubControls.gotoTime).toHaveBeenCalled());
  return utils;
};

beforeEach(() => {
  mockCompleted = new Set<number>();
  controlsProps = undefined;
  playerProps = undefined;
  confirmShown = false;
  confirmDismiss = undefined;
  mockStepComplete = false;
  mockRecordingRow = undefined;
  ctx._seg = regions[0];
  ctx.currentSegmentIndex = 0;
  jest.clearAllMocks();
  mockWaitForSave.mockResolvedValue(undefined);
  mockSetStepComplete.mockResolvedValue(undefined);
  stubControls.isReady.mockReturnValue(true);
  stubControls.isPlaying.mockReturnValue(false);
  stubControls.gotoTime.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe('PassageDetailCarefulSpeech — entry positioning', () => {
  it('listen pass (no recordings): positions on first clause without auto-playing', async () => {
    mockCompleted = new Set();
    await mountAndSettle();

    expect(controlsProps?.recordingPassStarted).toBe(false);
    // positioned (gotoTime) but not auto-played (no setPlay(true))
    expect(stubControls.gotoTime).toHaveBeenCalled();
    expect(stubControls.setPlay).not.toHaveBeenCalledWith(true);
  });

  it('recording pass (some recordings): auto-plays the first unrecorded clause', async () => {
    mockCompleted = new Set([0, 1]); // first incomplete is clause 2
    await mountAndSettle();

    expect(controlsProps?.recordingPassStarted).toBe(true);
    await waitFor(() =>
      expect(stubControls.setPlay).toHaveBeenCalledWith(true)
    );
    // it positioned on clause 2 before playing
    expect(stubControls.gotoTime).toHaveBeenCalledWith(seekFor(2), regions[2]);
  });

  it('all clauses recorded: enters recording (review) mode and shows the dialog', async () => {
    mockCompleted = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    await mountAndSettle();

    expect(controlsProps?.recordingPassStarted).toBe(true);
    expect(controlsProps?.allClausesComplete).toBe(true);
    await waitFor(() => expect(confirmShown).toBe(true));
  });

  it('dismissing the all-complete dialog marks the step complete and advances', async () => {
    mockCompleted = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    await mountAndSettle();
    await waitFor(() => expect(confirmDismiss).toBeDefined());

    await act(async () => {
      confirmDismiss?.();
    });

    await waitFor(() =>
      expect(mockWaitForSave).toHaveBeenCalledWith(undefined, 200)
    );
    await waitFor(() =>
      expect(mockSetStepComplete).toHaveBeenCalledWith('step1', true)
    );
    expect(mockGotoNextStep).toHaveBeenCalled();
  });

  it('dismissing the all-complete dialog on a completed step does not advance', async () => {
    mockCompleted = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    mockStepComplete = true;
    await mountAndSettle();
    await waitFor(() => expect(confirmDismiss).toBeDefined());

    await act(async () => {
      confirmDismiss?.();
    });

    expect(mockSetStepComplete).not.toHaveBeenCalled();
    expect(mockGotoNextStep).not.toHaveBeenCalled();
  });
});

describe('PassageDetailCarefulSpeech — review and clear recording', () => {
  it('clearing a recording marks a completed step incomplete', async () => {
    mockCompleted = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    mockStepComplete = true;
    mockRecordingRow = { mediafile: { id: 'rec1' } };
    await mountAndSettle();

    const onClearRecording = controlsProps?.onClearRecording as
      | (() => void)
      | undefined;
    await act(async () => {
      onClearRecording?.();
    });

    await waitFor(() => expect(mockMemoryUpdate).toHaveBeenCalled());
    await waitFor(() =>
      expect(mockSetStepComplete).toHaveBeenCalledWith('step1', false)
    );
    expect(controlsProps?.phase).toBe('recordReady');
  });

  it('review mode: tapping a completed clause does not auto-play it', async () => {
    mockCompleted = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    const { rerender } = await mountAndSettle();

    stubControls.setPlay.mockClear();
    stubControls.gotoTime.mockClear();

    await moveEngineToClause(3, rerender);

    expect(stubControls.setPlay).not.toHaveBeenCalledWith(true);
    expect(stubControls.gotoTime).toHaveBeenCalledWith(seekFor(3), regions[3]);
    expect(controlsProps?.phase).toBe('recorded');
  });
});

describe('PassageDetailCarefulSpeech — recording-pass playback', () => {
  it('parks on the clause after it finishes playing (recordReady, allowRecord)', async () => {
    mockCompleted = new Set([0, 1]); // auto-play clause 2
    await mountAndSettle();

    await firePlaybackEnd(2);

    await waitFor(() => expect(controlsProps?.phase).toBe('recordReady'));
    expect(controlsProps?.allowRecord).toBe(true);
  });

  it('swallows the +1 overshoot after a park (stays on the played clause)', async () => {
    mockCompleted = new Set([0, 1]); // auto-play clause 2
    const { rerender } = await mountAndSettle();
    await firePlaybackEnd(2); // park on clause 2, arm overshoot swallow

    stubControls.setPlay.mockClear();
    stubControls.gotoTime.mockClear();

    // overshoot: engine drifts into clause 3
    await moveEngineToClause(3, rerender);

    // did not start playing clause 3 ...
    expect(stubControls.setPlay).not.toHaveBeenCalledWith(true);
    // ... and re-asserted clause 2's start
    expect(stubControls.gotoTime).toHaveBeenCalledWith(seekFor(2), regions[2]);
  });

  it('plays a non-adjacent tapped clause (not treated as overshoot)', async () => {
    mockCompleted = new Set([0, 1]); // auto-play clause 2
    const { rerender } = await mountAndSettle();
    await firePlaybackEnd(2); // park on clause 2, arm overshoot swallow

    stubControls.setPlay.mockClear();
    stubControls.gotoTime.mockClear();

    // user taps the second-to-last clause (idx 6) — far from clause 2
    await moveEngineToClause(6, rerender);

    await waitFor(() =>
      expect(stubControls.gotoTime).toHaveBeenCalledWith(seekFor(6), regions[6])
    );
    expect(stubControls.setPlay).toHaveBeenCalledWith(true);
  });
});
