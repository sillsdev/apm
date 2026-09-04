import React from 'react';
import { act, cleanup, render, waitFor } from '@testing-library/react';
import { IRegion } from '../../crud/useWavesurferRegions';
import {
  regionsJsonFromList,
  regionBoundariesEqual,
} from './carefulSpeech/carefulSpeechBoundary';
import { boldDefaultSegParams } from './carefulSpeech/boldCarefulSpeechSegParams';
import { phraseBackTranslateConfig } from './guidedPhraseRecord/types';
import { ArtifactTypeSlug } from '../../crud/artifactTypeSlug';
import { NamedRegions } from '../../utils/namedSegments';
import type { IGuidedPhraseRecordControlStrings } from './guidedPhraseRecord/types';

/**
 * Multi-level segment-boundary Undo for Phrase Back Translate (TT-7437).
 *
 * The reported defect: clicking Undo reverts ALL previous boundary edits at
 * once instead of one at a time. The undo stack pops one snapshot, so the fault
 * is on the PUSH side.
 *
 * Verified against the real app (manual log): the failure is NOT caused by fast
 * clicking. Two facts from the waveform make it happen even with seconds
 * between edits:
 *
 *  1. One boundary add fires the segment callback MORE THAN ONCE. Adding a
 *     boundary splits a region, and the waveform emits an event for each
 *     affected region — two `onSegment` calls (and two saves) per add.
 *  2. The waveform registers that callback ONCE, capturing a STALE closure
 *     (the ADR-0006 pattern that `handleRegionPlayEndRef` exists to work
 *     around — `onSegment` has no such ref forwarding). So the handler runs
 *     with an out-of-date `clauseSegString` and keeps pushing an old snapshot.
 *
 * pushSegmentUndo photographs the closed-over `clauseSegString`
 * ([PassageDetailGuidedPhraseRecord.tsx] pushSegmentUndo). With a stale closure
 * that snapshot is the pre-edit (often the original) segmentation, so the top
 * of the undo stack is the baseline and one Undo reverts everything.
 *
 * These tests model BOTH facts: the waveform's callback is captured once
 * (`captureWaveformCallback`) and each add fires it twice (`addBoundary`). That
 * is why the earlier "one edit at a time" test was a FALSE PASS — it re-read a
 * fresh callback per edit and committed between edits, a flow the real app
 * never takes.
 *
 * The current segmentation is observed through the player's `suggestedSegments`
 * prop, which the component feeds from `clauseSegString`.
 */

// ---- segmentations: each "add" inserts one more boundary ---------------------
const regionsA: IRegion[] = [
  { start: 0, end: 10, label: '' },
  { start: 10, end: 20, label: '' },
  { start: 20, end: 30, label: '' },
]; // 3 segments — starting point
const regionsB: IRegion[] = [
  { start: 0, end: 5, label: '' },
  { start: 5, end: 10, label: '' },
  { start: 10, end: 20, label: '' },
  { start: 20, end: 30, label: '' },
]; // 4 segments — added a boundary at 5
const regionsC: IRegion[] = [
  { start: 0, end: 5, label: '' },
  { start: 5, end: 10, label: '' },
  { start: 10, end: 15, label: '' },
  { start: 15, end: 20, label: '' },
  { start: 20, end: 30, label: '' },
]; // 5 segments — added a boundary at 15

const jsonA = regionsJsonFromList(regionsA, boldDefaultSegParams);
const jsonB = regionsJsonFromList(regionsB, boldDefaultSegParams);
const jsonC = regionsJsonFromList(regionsC, boldDefaultSegParams);

// ---- mutable test state shared with the mocks -------------------------------
let controlsProps: Record<string, unknown> | undefined;
let playerProps: Record<string, unknown> | undefined;

const stubControls = {
  isReady: jest.fn(() => true),
  isPlaying: jest.fn(() => false),
  gotoTime: jest.fn().mockResolvedValue(undefined),
  setPlay: jest.fn(),
  applyRegionColors: jest.fn(),
  loadRegionsJson: jest.fn(),
  getProgress: jest.fn(() => 0),
  getPlaybackRate: jest.fn(() => 1),
};

const ctx: {
  _seg: IRegion | undefined;
  currentSegmentIndex: number;
  [k: string]: unknown;
} = {
  _seg: regionsA[0],
  currentSegmentIndex: 0,
  currentSegmentSeq: 0,
  passage: { id: 'p1', type: 'passage' },
  playerMediafile: { id: 'm1', type: 'mediafile' },
  mediafileId: 'm1',
  rowData: [],
  currentstep: 'step1',
  section: { id: 's1', type: 'section' },
  setCurrentSegment: jest.fn((region: IRegion) => {
    ctx._seg = region;
    ctx.currentSegmentIndex += 1;
    ctx.currentSegmentSeq = (ctx.currentSegmentSeq as number) + 1;
  }),
  setPlaying: jest.fn(),
  setRecording: jest.fn(),
  forceRefresh: jest.fn(),
  getCurrentSegment: jest.fn(() => ctx._seg),
  isBoldWorkflow: false,
  carefulSpeechSegParams: {},
  setCarefulSpeechSegParams: jest.fn(),
  setStepComplete: jest.fn().mockResolvedValue(undefined),
  stepComplete: jest.fn(() => false),
};

// ---- mocks ------------------------------------------------------------------
jest.mock('../../context/usePassageDetailContext', () => () => ctx);

// Stateful segments hook: real useState so edits/undo actually re-render, and a
// stable setter (like the real useState setter) so even a STALE handleSegment
// closure can still advance the committed state — only its READ of
// clauseSegString is stale, which is the whole point.
jest.mock('./carefulSpeech/useGuidedPhraseSegments', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  return {
    useGuidedPhraseSegments: () => {
      const [phraseSegString, setPhraseSegString] = ReactActual.useState(jsonA);
      return {
        phraseSegString,
        setPhraseSegString,
        bootstrapped: true,
        ensureSegments: jest.fn().mockResolvedValue(true),
        resetForMediafile: jest.fn(),
        resegmentWithParams: jest.fn().mockResolvedValue(false),
        resetToDefaultSegments: jest.fn().mockResolvedValue(false),
        persistPhraseSegments: jest.fn().mockResolvedValue(undefined),
      };
    },
  };
});

jest.mock('./carefulSpeech/carefulSpeechCompletion', () => {
  const actual = jest.requireActual('./carefulSpeech/carefulSpeechCompletion');
  return {
    ...actual,
    getCompletedClauseIndices: jest.fn(() => new Set<number>()),
    getRecordingForClause: jest.fn(() => undefined),
  };
});

jest.mock('../../crud', () => ({
  ArtifactTypeSlug: {
    PhraseBackTranslation: 'phrase-back-translation',
    Vernacular: 'vernacular',
    Retell: 'retell',
  },
  remoteIdGuid: jest.fn((_t: string, id: string) => id),
  useArtifactType: () => ({ getTypeId: () => 'art1', slugFromId: () => 'x' }),
  useStepTool: () => ({
    settings: { artifactTypeId: 'art1', language: 'French|fr' },
  }),
}));
jest.mock('../../crud/related', () => ({ related: () => 'p1' }));
jest.mock('../../utils/useStepPermission', () => ({
  useStepPermissions: () => ({ canDoSectionStep: () => true }),
}));
jest.mock('../../crud/isLinkedNote', () => ({ isLinkedNote: () => false }));
jest.mock('../../utils/passageDefaultFilename', () => ({
  passageDefaultFilename: () => 'file.ogg',
}));
jest.mock('../../selector', () => ({
  sharedSelector: jest.fn(),
  mediaTabSelector: jest.fn(),
  mediaTitleSelector: jest.fn(),
}));
jest.mock('react-redux', () => ({
  useSelector: () => ({}),
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

// imported after the mocks so the component picks them up
import { PassageDetailGuidedPhraseRecord } from './PassageDetailGuidedPhraseRecord';

const config = phraseBackTranslateConfig(
  ArtifactTypeSlug.PhraseBackTranslation,
  NamedRegions.BackTranslation
);

const controlStrings: IGuidedPhraseRecordControlStrings = {
  allComplete: 'All recorded',
  unitLabel: 'Segment {0}',
  clearRecording: 'Clear',
  combineWithNext: 'Combine',
  fewerUnits: 'Fewer',
  moreUnits: 'More',
  nextUnit: 'Next',
  splitUnit: 'Split',
  speaker: 'Speaker',
  startRecording: 'Start',
  undo: 'Undo',
};

type SegmentCb = (seg: string, init: boolean) => Promise<void> | void;

const currentSegments = () =>
  playerProps?.suggestedSegments as string | undefined;

// The waveform registers its region listener ONCE and keeps calling that same
// (stale) callback afterwards — so capture it a single time and reuse it,
// rather than re-reading the freshest handler each edit.
const captureWaveformCallback = (): SegmentCb => playerProps?.onSegment as SegmentCb;

// Model one user "add a boundary": the waveform fires the (stale) callback twice
// for the one gesture (the split emits an event per affected region).
const addBoundary = async (cb: SegmentCb, json: string) => {
  await act(async () => {
    await cb(json, false);
    await cb(json, false);
  });
};

const fireUndo = async () => {
  const onSegmentUndo = playerProps?.onSegmentUndo as (() => void) | undefined;
  await act(async () => {
    onSegmentUndo?.();
  });
};

const mountAndSettle = async () => {
  const utils = render(
    <PassageDetailGuidedPhraseRecord
      width={400}
      config={config}
      controlStrings={controlStrings}
    />
  );
  await waitFor(() => expect(playerProps).toBeDefined());
  await waitFor(() => expect(currentSegments()).toBeDefined());
  return utils;
};

beforeEach(() => {
  controlsProps = undefined;
  playerProps = undefined;
  ctx._seg = regionsA[0];
  ctx.currentSegmentIndex = 0;
  ctx.currentSegmentSeq = 0;
  jest.clearAllMocks();
  stubControls.isReady.mockReturnValue(true);
  stubControls.isPlaying.mockReturnValue(false);
  stubControls.gotoTime.mockResolvedValue(undefined);
});

afterEach(() => cleanup());

describe('Phrase Back Translate — multi-level segment Undo (TT-7437)', () => {
  it('has multi-level undo enabled for this step', () => {
    expect(config.multiLevelSegmentUndo).toBe(true);
  });

  // The manual repro, faithfully: two boundary adds, spaced out, then one Undo.
  // Each add is delivered through the waveform's single captured callback and
  // fires twice. Undo must step back exactly ONE add.
  it('undoes ONE add per click (matches the manual repro)', async () => {
    await mountAndSettle();
    const waveform = captureWaveformCallback();
    expect(regionBoundariesEqual(currentSegments()!, jsonA)).toBe(true);

    await addBoundary(waveform, jsonB);
    expect(regionBoundariesEqual(currentSegments()!, jsonB)).toBe(true);

    await addBoundary(waveform, jsonC);
    expect(regionBoundariesEqual(currentSegments()!, jsonC)).toBe(true);

    // First Undo: back to B (remove only the last boundary), NOT all the way to A.
    await fireUndo();
    expect(regionBoundariesEqual(currentSegments()!, jsonB)).toBe(true);

    // Second Undo: back to A.
    await fireUndo();
    expect(regionBoundariesEqual(currentSegments()!, jsonA)).toBe(true);
  });

  // Isolates fact #1: a single add fires the callback twice, so it must record
  // only ONE undo entry. Observing state alone can't see the extra entry (both
  // duplicates are the same snapshot), so assert the button disables after one
  // Undo — the extra entry keeps it enabled.
  it('records ONE undo entry for a single add even though it fires twice', async () => {
    await mountAndSettle();
    const waveform = captureWaveformCallback();

    await addBoundary(waveform, jsonB); // one gesture, two callback fires
    expect(playerProps?.hasSegmentUndo).toBe(true);

    await fireUndo();
    expect(regionBoundariesEqual(currentSegments()!, jsonA)).toBe(true);
    // Exactly one add was made, so after one Undo there must be nothing left.
    expect(playerProps?.hasSegmentUndo).toBe(false);
  });
});
