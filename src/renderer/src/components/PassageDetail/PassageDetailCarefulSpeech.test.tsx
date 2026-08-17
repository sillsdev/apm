import React from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { IRegion } from '../../crud/useWavesurferRegions';
import { CLAUSE_BOUNDARY_THRESHOLD_SEC } from './carefulSpeech/carefulSpeechBoundary';
import {
  CAREFUL_SPEECH_COMPLETED_RGBA,
  CAREFUL_SPEECH_PENDING_RGBA,
} from '../../utils/carefulSpeechSegmentColors';

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
let mockRecordingRow:
  | { mediafile: { id: string; attributes?: { sourceSegments?: string } } }
  | undefined;

const mockSetStepComplete = jest.fn().mockResolvedValue(undefined);
const mockWaitForSave = jest.fn().mockResolvedValue(undefined);
const mockStartSave = jest.fn();
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
  stepComplete: jest.fn(() => mockStepComplete),
  // updating the engine segment keeps getCurrentSegment consistent with the
  // index the component believes it is on.
  setCurrentSegment: jest.fn((region: IRegion) => {
    ctx._seg = region;
    ctx.currentSegmentIndex += 1;
  }),
};

// ---- mocks ------------------------------------------------------------------
jest.mock('../../context/usePassageDetailContext', () => () => ctx);

jest.mock('./carefulSpeech/useGuidedPhraseSegments', () => ({
  useGuidedPhraseSegments: () => ({
    phraseSegString: '[]',
    setPhraseSegString: jest.fn(),
    bootstrapped: true,
    ensureSegments: jest.fn().mockResolvedValue(true),
    resetForMediafile: jest.fn(),
    resegmentWithParams: jest.fn().mockResolvedValue(false),
    resetToDefaultSegments: jest.fn().mockResolvedValue(false),
    persistPhraseSegments: jest.fn().mockResolvedValue(undefined),
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
  useArtifactType: () => ({
    localIdFromSlug: () => 'art1',
    slugFromId: () => 'carefulspeech',
  }),
  useStepTool: () => ({ settings: { artifactTypeId: 'art1' } }),
}));
jest.mock('../../crud/related', () => ({ related: () => 'p1' }));
jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({ canDoSectionStep: () => true }),
}));
jest.mock('../../utils/passageDefaultFilename', () => ({
  passageDefaultFilename: () => 'file.ogg',
}));
jest.mock('../../selector', () => ({
  carefulSpeechSelector: jest.fn(),
  sharedSelector: jest.fn(),
  mediaTabSelector: jest.fn(),
  mediaTitleSelector: jest.fn(),
}));
jest.mock('react-redux', () => ({
  useSelector: () => ({
    boldOnly: 'BOLD only',
    allComplete: 'All clauses recorded',
    clause: 'Clause: {0}',
    clearRecording: 'Clear',
    combineWithNextClause: 'Combine',
    fewerClauses: 'Fewer',
    moreClauses: 'More',
    nextClause: 'Next',
    splitClause: 'Split',
    speaker: 'Speaker',
    startRecording: 'Start',
    undo: 'Undo',
    // mediaTitle + mediaTab strings the save-failure banner reads
    uploadFailed: 'Upload Failed!',
    pendingUploadRetryOne: 'Retry',
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
      state: { startSave: mockStartSave, waitForSave: mockWaitForSave },
    }),
  };
});
jest.mock('../../hoc/useOrbitData', () => ({
  useOrbitData: () => [
    { id: 'm1', type: 'mediafile', attributes: { versionNumber: 1 } },
  ],
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

let mockStepComplete = false;

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

  it('all clauses recorded: enters review mode and marks step complete without advancing', async () => {
    mockCompleted = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    await mountAndSettle();

    expect(controlsProps?.recordingPassStarted).toBe(true);
    expect(controlsProps?.allClausesComplete).toBe(true);
    await waitFor(() =>
      expect(mockWaitForSave).toHaveBeenCalledWith(undefined, 200)
    );
    await waitFor(() =>
      expect(mockSetStepComplete).toHaveBeenCalledWith('step1', true)
    );
  });

  it('marks step incomplete when any clause recording is missing', async () => {
    mockCompleted = new Set([0, 1, 2]);
    mockStepComplete = true;
    await mountAndSettle();

    await waitFor(() =>
      expect(mockSetStepComplete).toHaveBeenCalledWith('step1', false)
    );
  });
});

describe('PassageDetailCarefulSpeech — review and clear recording', () => {
  it('clearing a recording marks a completed step incomplete', async () => {
    mockCompleted = new Set([0, 1, 2, 3, 4, 5, 6, 7]);
    mockStepComplete = true;
    mockRecordingRow = { mediafile: { id: 'rec1' } };
    // Removing the current clause's recording drops it from the completed set
    // and clears its recording row — mirror that data change so the
    // completed-clause effect doesn't re-force phase back to 'recorded'.
    mockMemoryUpdate.mockImplementation(async () => {
      mockCompleted = new Set([1, 2, 3, 4, 5, 6, 7]);
      mockRecordingRow = undefined;
    });
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
    await waitFor(() => expect(controlsProps?.phase).toBe('recordReady'));
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

describe('PassageDetailCarefulSpeech — recording segment lock (TT-7437)', () => {
  it('locks the source player while a clause recording is in progress', async () => {
    mockCompleted = new Set([0, 1]);
    await mountAndSettle();
    await firePlaybackEnd(2);

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
    });

    expect(playerProps?.lockSegmentSelection).toBe(true);
  });

  it('ignores segment changes while recording is in progress', async () => {
    mockCompleted = new Set([0, 1]);
    const { rerender } = await mountAndSettle();
    await firePlaybackEnd(2);

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
    });

    stubControls.setPlay.mockClear();
    stubControls.gotoTime.mockClear();

    await moveEngineToClause(6, rerender);

    expect(stubControls.setPlay).not.toHaveBeenCalledWith(true);
    expect(stubControls.gotoTime).not.toHaveBeenCalledWith(
      seekFor(6),
      regions[6]
    );
    expect(controlsProps?.phase).toBe('recording');
  });

  it('sets context recording while a clause recording is in progress', async () => {
    mockCompleted = new Set([0, 1]);
    await mountAndSettle();
    await firePlaybackEnd(2);

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
    });

    expect(ctx.setRecording).toHaveBeenCalledWith(true);
  });
});

describe('PassageDetailCarefulSpeech — segment change after take (TT-7552)', () => {
  it('after saving a take, tapping the next clause advances and resets the recorder', async () => {
    mockCompleted = new Set([0, 1]); // auto-play clause 2
    const { rerender } = await mountAndSettle();
    await firePlaybackEnd(2); // park on clause 2 (arms overshoot swallow)

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
      (controlsProps?.onRecording as (active: boolean) => void)(false);
    });
    await act(async () => {
      await (
        controlsProps?.afterUploadCb as (
          mediaId: string | undefined
        ) => Promise<void>
      )('media-new');
    });
    mockCompleted = new Set([0, 1, 2]);
    expect(controlsProps?.resetMedia).toBe(false);

    stubControls.setPlay.mockClear();
    stubControls.gotoTime.mockClear();

    // User taps the next clause on the waveform (adjacent — same path as overshoot).
    await moveEngineToClause(3, rerender);

    await waitFor(() =>
      expect(stubControls.gotoTime).toHaveBeenCalledWith(seekFor(3), regions[3])
    );
    await waitFor(() => expect(controlsProps?.resetMedia).toBe(true));
  });

  it('marks the just-saved clause completed for coloring before rowData catches up', async () => {
    mockCompleted = new Set([0, 1]); // auto-play clause 2; rowData still lacks clause 2 after save
    await mountAndSettle();
    await firePlaybackEnd(2);

    const applyRegionColor = () =>
      (
        playerProps?.applyRegionColor as
          | ((role: string, index: number, count: number) => string)
          | undefined
      )?.('base', 2, 8);

    expect(applyRegionColor()).toBe(CAREFUL_SPEECH_PENDING_RGBA);

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
      (controlsProps?.onRecording as (active: boolean) => void)(false);
    });
    await act(async () => {
      await (
        controlsProps?.afterUploadCb as (
          mediaId: string | undefined
        ) => Promise<void>
      )('media-new');
    });

    // rowData / mockCompleted intentionally still omit clause 2 — coloring must
    // still treat it as done so green shows when advancing (TT-7552).
    expect(applyRegionColor()).toBe(CAREFUL_SPEECH_COMPLETED_RGBA);
    expect(stubControls.applyRegionColors).toHaveBeenCalled();
  });

  it('does not mark the clause completed when the upload returns no media id', async () => {
    mockCompleted = new Set([0, 1]);
    await mountAndSettle();
    await firePlaybackEnd(2);

    const applyRegionColor = () =>
      (
        playerProps?.applyRegionColor as
          | ((role: string, index: number, count: number) => string)
          | undefined
      )?.('base', 2, 8);

    expect(applyRegionColor()).toBe(CAREFUL_SPEECH_PENDING_RGBA);

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
      (controlsProps?.onRecording as (active: boolean) => void)(false);
    });
    await act(async () => {
      await (
        controlsProps?.afterUploadCb as (
          mediaId: string | undefined
        ) => Promise<void>
      )(undefined);
    });

    // Nothing was stored, so the clause must stay pending rather than showing
    // the user a green segment for audio that was lost (TT-7583).
    expect(applyRegionColor()).toBe(CAREFUL_SPEECH_PENDING_RGBA);
  });
});

describe('PassageDetailCarefulSpeech — save in progress (TT-7439)', () => {
  it('disables Next Clause and locks segments once save begins', async () => {
    mockCompleted = new Set([0, 1]);
    await mountAndSettle();
    await firePlaybackEnd(2);

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
      (controlsProps?.onRecording as (active: boolean) => void)(false);
    });
    await act(async () => {
      (controlsProps?.setCanSave as (v: boolean) => void)(true);
    });

    expect(controlsProps?.savingRecording).toBe(true);
    expect(playerProps?.lockSegmentSelection).toBe(true);
  });

  it('does not stick saving when recording never started', async () => {
    mockCompleted = new Set([0, 1]);
    await mountAndSettle();
    await firePlaybackEnd(2);

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(false);
    });

    expect(controlsProps?.savingRecording).toBe(false);
    expect(controlsProps?.phase).toBe('recordReady');
  });

  it('re-enables Next Clause after upload completes', async () => {
    mockCompleted = new Set([0, 1]);
    await mountAndSettle();
    await firePlaybackEnd(2);

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
      (controlsProps?.onRecording as (active: boolean) => void)(false);
    });
    await act(async () => {
      (controlsProps?.setCanSave as (v: boolean) => void)(true);
    });
    await act(async () => {
      await (
        controlsProps?.afterUploadCb as (
          mediaId: string | undefined
        ) => Promise<void>
      )('media-new');
    });

    expect(controlsProps?.savingRecording).toBe(false);
    expect(playerProps?.lockSegmentSelection).toBe(false);
  });
});

describe('PassageDetailCarefulSpeech — rejected save (TT-7583)', () => {
  // Record a take and request its auto-save, then have MediaRecord reject it.
  const recordAndRejectSave = async () => {
    mockCompleted = new Set([0, 1]);
    const utils = await mountAndSettle();
    await firePlaybackEnd(2);

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
      (controlsProps?.onRecording as (active: boolean) => void)(false);
    });
    await act(async () => {
      (controlsProps?.setCanSave as (v: boolean) => void)(true);
    });
    await act(async () => {
      (controlsProps?.onSaveRejected as () => void)();
      await (
        controlsProps?.afterUploadCb as (
          mediaId: string | undefined
        ) => Promise<void>
      )('');
    });
    return utils;
  };

  it('shows the save failure message with a Retry button', async () => {
    await recordAndRejectSave();

    expect(screen.getByText('Upload Failed!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeEnabled();
    expect(controlsProps?.savingRecording).toBe(false);
  });

  it('keeps the take discardable but not re-recordable', async () => {
    await recordAndRejectSave();

    // 'recorded' is what shows the clear button and hides Record: discarding the
    // take is the deliberate way back to recording, so a stray tap cannot
    // silently overwrite audio that is not stored yet.
    expect(controlsProps?.phase).toBe('recorded');
    expect(controlsProps?.allowRecord).toBe(false);
  });

  it('clearing a failed take resets the recorder even with no mediafile', async () => {
    mockRecordingRow = undefined; // nothing was stored, so nothing to remove
    await recordAndRejectSave();

    await act(async () => {
      (controlsProps?.onClearRecording as () => void)();
    });

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    await waitFor(() => expect(controlsProps?.resetMedia).toBe(true));
  });

  it('drops the message when the user moves to another clause', async () => {
    const { rerender } = await recordAndRejectSave();
    expect(screen.getByText('Upload Failed!')).toBeInTheDocument();

    await moveEngineToClause(3, rerender);

    // The take it referred to is gone, so a Retry here could only fail.
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });

  it('Retry requests the save again and clears the message', async () => {
    await recordAndRejectSave();
    mockStartSave.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(mockStartSave).toHaveBeenCalledWith('CarefulSpeechTool');
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(controlsProps?.savingRecording).toBe(true);
  });

  it('clears the message when a new take starts', async () => {
    await recordAndRejectSave();

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
    });

    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
  });
});
