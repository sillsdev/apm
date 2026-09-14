import { act, cleanup, render, waitFor } from '@testing-library/react';
import { IRegion } from '../../crud/useWavesurferRegions';

/**
 * TT-7690 - Record button stays inactive after clicking Next during playback.
 *
 * Repro of the reported flow (PBT / Careful Speech):
 *   1) three segments; record segment 1, auto-save
 *   2) Play segment 1
 *   3) *while it is still playing* click Next -> segment 2 is selected and plays
 *   4) let segment 2 finish
 *   -> the Record button never re-enables.
 *
 * Root cause lives in `playCurrentClause`: after seeking to the new clause it
 * only (re)starts playback when `!ctrl.isPlaying()`. When Next is pressed while
 * audio is still playing that guard is true, so `setPlay(true)` is skipped and
 * the region for the new clause is never armed (`gotoTime` -> `wsGoto` clears
 * `playRegionRef` via `resetPlayingRegion`). With no armed region, the
 * `region-out` handler never fires `onRegionPlayEnd` when the new segment ends,
 * so `handleRegionPlayEnd` never runs, `phase` never becomes 'recordReady' and
 * `currentClausePlayed` stays false -> `allowRecord` stays false -> Record is
 * disabled.
 *
 * The observable seam here is whether Next (re)starts region playback for the
 * new clause. Restarting playback (setPlay(true)) is the only lever the
 * component pulls to arm `playRegionRef`, so a correct fix must call it even
 * when playback is already running. The "playing" case below currently fails;
 * the "paused" case is the passing baseline that shows the contrast.
 */

const regions: IRegion[] = [
  { start: 0, end: 10, label: '' },
  { start: 10, end: 20, label: '' },
  { start: 20, end: 30, label: '' },
];

let mockCompleted = new Set<number>();
let controlsProps: Record<string, unknown> | undefined;
let mockRecordingRow:
  | { mediafile: { id: string; attributes?: Record<string, unknown> } }
  | undefined;

const stepSettings: Record<string, Record<string, unknown>> = {
  'step-sena': { artifactTypeId: 'art1', language: 'Sena|seh' },
};

const stubControls = {
  isReady: jest.fn(() => true),
  isPlaying: jest.fn(() => false),
  gotoTime: jest.fn().mockResolvedValue(undefined),
  setPlay: jest.fn(),
  applyRegionColors: jest.fn(),
  loadRegionsJson: jest.fn(),
};

const ctx: {
  _seg: IRegion | undefined;
  currentSegmentIndex: number;
  currentstep: string;
  [k: string]: unknown;
} = {
  _seg: regions[0],
  currentSegmentIndex: 0,
  currentstep: 'step-sena',
  passage: { id: 'p1', type: 'passage' },
  playerMediafile: { id: 'm1', type: 'mediafile' },
  mediafileId: 'm1',
  rowData: [],
  section: { id: 's1', type: 'section' },
  setPlaying: jest.fn(),
  setRecording: jest.fn(),
  forceRefresh: jest.fn(),
  getCurrentSegment: jest.fn(() => ctx._seg),
  isBoldWorkflow: false,
  carefulSpeechSegParams: {},
  setCarefulSpeechSegParams: jest.fn(),
  setStepComplete: jest.fn().mockResolvedValue(undefined),
  stepComplete: jest.fn(() => false),
  setCurrentSegment: jest.fn((region: IRegion) => {
    ctx._seg = region;
    ctx.currentSegmentIndex += 1;
  }),
};

jest.mock('../../context/usePassageDetailContext', () => () => ctx);

jest.mock('./carefulSpeech/useGuidedPhraseSegments', () => ({
  useGuidedPhraseSegments: () => ({
    phraseSegString: '[]',
    setPhraseSegString: jest.fn(),
    bootstrapped: true,
    ensureSegments: jest.fn().mockResolvedValue(true),
    resetForScope: jest.fn(),
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
  ArtifactTypeSlug: { PhraseBackTranslation: 'phrase-back-translation' },
  remoteIdGuid: jest.fn((_t: string, id: string) => id),
  useArtifactType: () => ({ getTypeId: () => 'art1' }),
  useStepTool: (step: string) => ({ settings: stepSettings[step] ?? {} }),
}));
jest.mock('../../crud/related', () => ({ related: () => 'p1' }));
jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({ canDoSectionStep: () => true }),
}));
jest.mock('../../utils/passageDefaultFilename', () => ({
  passageDefaultFilename: (...args: unknown[]) =>
    `GEN001_014-019${args[5]}_plan`,
}));
jest.mock('../../selector', () => ({
  sharedSelector: jest.fn(),
  mediaTabSelector: jest.fn(),
  mediaTitleSelector: jest.fn(),
}));
jest.mock('react-redux', () => ({
  useSelector: () => ({
    uploadFailed: 'Upload Failed!',
    pendingUploadRetryOne: 'Retry',
  }),
  shallowEqual: jest.fn(),
}));
jest.mock('../../context/useGlobal', () => ({
  useGlobal: (key: string) =>
    key === 'memory'
      ? [
          { keyMap: {}, update: jest.fn().mockResolvedValue(undefined) },
          jest.fn(),
        ]
      : [undefined, jest.fn()],
}));
jest.mock('../../context/UnsavedContext', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    UnsavedContext: ReactActual.createContext({
      state: {
        startSave: jest.fn(),
        waitForSave: jest.fn().mockResolvedValue(undefined),
      },
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

// imported after the mocks so the component picks them up
import { PassageDetailGuidedPhraseRecord } from './PassageDetailGuidedPhraseRecord';
import { phraseBackTranslateConfig } from './guidedPhraseRecord/types';
import { ArtifactTypeSlug } from '../../crud/artifactTypeSlug';
import { NamedRegions } from '../../utils/namedSegments';

const config = phraseBackTranslateConfig(
  ArtifactTypeSlug.PhraseBackTranslation,
  NamedRegions.BackTranslation
);

const strings = {
  allComplete: 'All segments recorded',
  unitLabel: 'Segment: {0}',
  clearRecording: 'Clear',
  combineWithNext: 'Combine',
  fewerUnits: 'Fewer',
  moreUnits: 'More',
  nextUnit: 'Next',
  splitUnit: 'Split',
  speaker: 'Speaker',
  startRecording: 'Start',
  undo: 'Undo',
  noStepLanguage: 'Configure a language',
};

const ui = () => (
  <PassageDetailGuidedPhraseRecord
    width={400}
    config={config}
    controlStrings={strings}
  />
);

const mountAndSettle = async () => {
  const utils = render(ui());
  await waitFor(() => expect(controlsProps).toBeDefined());
  await waitFor(() => expect(stubControls.gotoTime).toHaveBeenCalled());
  return utils;
};

/** Enter the recording pass so Next navigates between clauses (plays each). */
const startRecordingPass = async () => {
  await act(async () => {
    (controlsProps?.onStartRecording as () => void)();
  });
  await waitFor(() =>
    expect(controlsProps?.recordingPassStarted).toBe(true)
  );
};

beforeEach(() => {
  mockCompleted = new Set<number>();
  controlsProps = undefined;
  mockRecordingRow = undefined;
  ctx._seg = regions[0];
  ctx.currentSegmentIndex = 0;
  ctx.currentstep = 'step-sena';
  jest.clearAllMocks();
  stubControls.isReady.mockReturnValue(true);
  stubControls.isPlaying.mockReturnValue(false);
  stubControls.gotoTime.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe('PassageDetailGuidedPhraseRecord - Next during playback (TT-7690)', () => {
  it('baseline: Next while paused starts playback of the next clause', async () => {
    await mountAndSettle();
    await startRecordingPass();

    // Not playing when Next is pressed.
    stubControls.isPlaying.mockReturnValue(false);
    stubControls.setPlay.mockClear();

    await act(async () => {
      (controlsProps?.onNextUnitSequential as () => void)();
    });

    // Region playback for the new clause is (re)started -> region-out will fire
    // onRegionPlayEnd -> Record re-enables when it ends.
    await waitFor(() =>
      expect(stubControls.setPlay).toHaveBeenCalledWith(true)
    );
  });

  it('Next *during playback* still (re)starts playback of the next clause', async () => {
    await mountAndSettle();
    await startRecordingPass();

    // Segment is currently playing when the user clicks Next.
    stubControls.isPlaying.mockReturnValue(true);
    stubControls.setPlay.mockClear();

    await act(async () => {
      (controlsProps?.onNextUnitSequential as () => void)();
    });

    // BUG (TT-7690): playCurrentClause skips setPlay(true) because isPlaying()
    // is true, so the new clause's region is never armed and the region-end
    // chain that re-enables Record never fires. A correct fix must (re)start
    // playback for the new clause here.
    await waitFor(() =>
      expect(stubControls.setPlay).toHaveBeenCalledWith(true)
    );
  });
});
