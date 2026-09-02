import { act, cleanup, render, waitFor } from '@testing-library/react';
import { IRegion } from '../../crud/useWavesurferRegions';

/**
 * TT-7643 - a team can configure one Phrase Back Translation step per language,
 * and every one of them renders this same component against the same vernacular
 * audio. Where the route does not remount it between steps (the mobile route
 * did not), the instance is reused, and everything it holds for the step just
 * left - the recording pass, the clause it is parked on, and the take mounted
 * in its recorder - carried into the next language's step, so that step played
 * the other language's audio.
 *
 * The component now scopes its own reset to the step as well as the mediafile,
 * so a reused instance still opens the next step from scratch.
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

/** Step settings by step id: two PBT steps, different languages. */
const stepSettings: Record<string, Record<string, unknown>> = {
  'step-sena': { artifactTypeId: 'art1', language: 'Sena|seh' },
  'step-hebrew': { artifactTypeId: 'art1', language: 'Hebrew|he' },
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

const mockResetForScope = jest.fn();
jest.mock('./carefulSpeech/useGuidedPhraseSegments', () => ({
  useGuidedPhraseSegments: () => ({
    phraseSegString: '[]',
    setPhraseSegString: jest.fn(),
    bootstrapped: true,
    ensureSegments: jest.fn().mockResolvedValue(true),
    resetForScope: mockResetForScope,
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
// Echo the postfix the config built, so a spec can see what the take would be
// named. Real signature: (passage, plan, memory, artifactType, offline, postfix).
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

describe('PassageDetailGuidedPhraseRecord - step scope (TT-7643)', () => {
  it('opens the next language step from scratch when the instance is reused', async () => {
    // Sena: every segment recorded, so the step opens in review mode with the
    // recorder mounted on Sena's take.
    mockCompleted = new Set([0, 1, 2]);
    mockRecordingRow = { mediafile: { id: 'sena-take-1' } };
    const { rerender } = await mountAndSettle();
    expect(controlsProps?.recordingPassStarted).toBe(true);
    expect(controlsProps?.showRecorder).toBe(true);
    expect(controlsProps?.recordingMediaId).toBe('sena-take-1');

    // Move to the Hebrew step without unmounting - nothing is recorded there.
    mockCompleted = new Set();
    mockRecordingRow = undefined;
    ctx.currentstep = 'step-hebrew';
    await act(async () => {
      rerender(ui());
    });

    await waitFor(() =>
      expect(controlsProps?.recordingPassStarted).toBe(false)
    );
    expect(controlsProps?.showRecorder).toBe(false);
    expect(controlsProps?.recordingMediaId).toBeUndefined();
    // The boundaries the new step opens on are the segment hook's business,
    // and this suite mocks that hook - so whether the reset it is handed
    // actually re-reads the next language's bucket is asserted against the
    // real hook in useGuidedPhraseSegments.test.tsx, not here.
    expect(mockResetForScope).toHaveBeenCalledWith('m1');
  });

  it('names a take so it cannot collide with another language of the same segment', async () => {
    // The uploaded file name is what the media cache is keyed on: `dataPath`
    // resolves a mediafile's audioUrl to `<offlineData>/media/<basename>`, so
    // two takes that upload under one name share one cached file and the first
    // one downloaded is what plays. Segment index and source version were in
    // the name but the step language was not, so Hebrew segment 1 and Sena
    // segment 1 were the same file (TT-7643).
    const { rerender } = await mountAndSettle();
    const senaName = controlsProps?.defaultFilename as string;
    expect(senaName).toContain('seh');

    ctx.currentstep = 'step-hebrew';
    await act(async () => {
      rerender(ui());
    });
    await waitFor(() =>
      expect(controlsProps?.defaultFilename).not.toEqual(senaName)
    );
    expect(controlsProps?.defaultFilename).toContain('he');
  });

  it('names each attempt at a segment apart from the one it replaces', async () => {
    // Clearing a take deletes its mediafile but not the audio cached under its
    // name, and the next attempt at the same segment in the same language
    // built the very same name - so `dataPath` handed the new take the old
    // take's file and the recording the user had just discarded played back
    // (TT-7432).
    await mountAndSettle();
    const firstAttempt = controlsProps?.defaultFilename as string;
    expect(firstAttempt).toBeTruthy();

    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
    });

    await waitFor(() =>
      expect(controlsProps?.defaultFilename).not.toEqual(firstAttempt)
    );
    // Still this segment, in this language - only the attempt is new.
    expect(controlsProps?.defaultFilename).toContain('backtranslation1');
    expect(controlsProps?.defaultFilename).toContain('seh');
  });

  it('holds a name steady for the length of one recording', async () => {
    await mountAndSettle();
    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(true);
    });
    const whileRecording = controlsProps?.defaultFilename as string;
    // The name is chosen when recording starts and has to survive every
    // re-render between there and the upload, or MediaRecord would save under
    // a different name than the one the step showed.
    await act(async () => {
      (controlsProps?.onRecording as (active: boolean) => void)(false);
    });
    await waitFor(() => expect(controlsProps).toBeDefined());
    expect(controlsProps?.defaultFilename).toEqual(whileRecording);
  });

  it('records against the language of the step now showing', async () => {
    const { rerender } = await mountAndSettle();
    expect(controlsProps?.languagebcp47).toBe('Sena|seh');

    ctx.currentstep = 'step-hebrew';
    await act(async () => {
      rerender(ui());
    });
    await waitFor(() => expect(controlsProps?.languagebcp47).toBe('Hebrew|he'));
  });
});
