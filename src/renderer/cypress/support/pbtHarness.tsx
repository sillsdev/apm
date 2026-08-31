/**
 * Cypress CT harness for the Phrase Back Translate (PBT) step.
 *
 * Mounts the REAL step (PassageDetailPhraseBackTranslate → PassageDetailGuidedPhraseRecord
 * → PassageDetailPlayer/WSAudioPlayer + MediaRecord) so UI-level defects show up:
 * record button enable/disable, playhead position, waveform region colors, and which
 * segment a take is actually saved against.
 *
 * What is real
 *  - the component tree, its state machine, wavesurfer, MediaRecord's save gating
 *  - a real Orbit Memory source (schema-backed), so memory.update / useOrbitData behave
 *  - the real UnsavedProvider (startSave/waitForSave orchestration)
 *  - the real upload action chain (POST /api/mediafiles then PUT of the audio)
 *
 * What is faked
 *  - the microphone: cy.installRecordingMocks() (see recordingMocks.ts)
 *  - the source audio: a generated WAV blob handed to the player through context
 *  - the server: cy.intercept on the mediafile POST/PUT/fileurl endpoints. The
 *    intercept records every posted take (so a spec can assert `source-segments`)
 *    and, after an optional lag, adds the mediafile to Memory the way a real
 *    pull would — which is what makes rowData-lag bugs reproducible.
 *  - PassageDetailContext: a small live "engine" that mirrors the real
 *    setCurrentSegment/getCurrentSegment/currentSegmentIndex + rowData semantics.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Provider } from 'react-redux';
import {
  applyMiddleware,
  combineReducers,
  legacy_createStore as createStore,
} from 'redux';
import { thunk } from 'redux-thunk';
import Memory from '@orbit/memory';
import Coordinator from '@orbit/coordinator';
import { RecordKeyMap } from '@orbit/records';

import { schema } from '../../src/schema';
import localizationReducer from '../../src/store/localization/reducers';
import bookReducer from '../../src/store/book/reducers';
import orbitReducer from '../../src/store/orbit/reducers';
import uploadReducer from '../../src/store/upload/reducers';
import paratextReducer from '../../src/store/paratext/reducers';
import exportReducer from '../../src/store/importexport/reducers';
import authReducer from '../../src/store/auth/reducers';
import { GlobalProvider, GlobalState } from '../../src/context/GlobalContext';
import { OrbitContext } from '../../src/hoc/OrbitContextProvider';
import { IOrbitContext } from '../../src/hoc/OrbitContext';
import { UnsavedProvider } from '../../src/context/UnsavedContext';
import { HotKeyContext } from '../../src/context/HotKeyContext';
import { PassageDetailContext } from '../../src/context/PassageDetailContext';
import type { IRow } from '../../src/context/PassageDetailContext';
import type { IRegion } from '../../src/crud/useWavesurferRegions';
import type { MediaFileD } from '../../src/model';
import { boldDefaultSegParams } from '../../src/components/PassageDetail/carefulSpeech/boldCarefulSpeechSegParams';
import { regionsJsonFromList } from '../../src/components/PassageDetail/carefulSpeech/carefulSpeechBoundary';
import { prettySegment } from '../../src/utils/prettySegment';
import { parseMediaLanguageBcp47 } from '../../src/utils/mediaLanguage';
import { phraseBtBoundaryRegionName } from '../../src/components/PassageDetail/carefulSpeech/matchesGuidedOutputRow';
import PassageDetailPhraseBackTranslate from '../../src/components/PassageDetail/PassageDetailPhraseBackTranslate';

// ---------------------------------------------------------------------------
// ids / constants shared between the harness and the specs
// ---------------------------------------------------------------------------

export const PBT = {
  container: 'phrase-back-translate',
  /** Prefix for CarefulSpeechControls ids (config.containerId). */
  start: '#phrase-back-translate-start',
  more: '#phrase-back-translate-more-clauses',
  fewer: '#phrase-back-translate-fewer-clauses',
  split: '#phrase-back-translate-split',
  combine: '#phrase-back-translate-combine',
  next: '#phrase-back-translate-next',
  prevUnit: '#phrase-back-translate-prev-unit',
  nextUnit: '#phrase-back-translate-next-unit',
  speaker: '#phrase-back-translate-speaker',
  retrySave: '#phrase-back-translate-retry-save',
  dockedRecord: '[data-cy="phrase-back-translate-docked-record"]',
  /** The record control itself (RecordButton renders role=button + aria-disabled). */
  recordButton:
    '[data-cy="phrase-back-translate-docked-record"] [role="button"]',
} as const;

export const VERNACULAR_ID = 'mf-vern';
export const VERNACULAR_REMOTE_ID = '900';
export const ARTIFACT_TYPE_ID = 'at-backtranslation';
export const ARTIFACT_TYPE_REMOTE_ID = '77';
export const STEP_ID = 'step-pbt';
export const PASSAGE_ID = 'passage-1';
export const SECTION_ID = 'section-1';
export const PLAN_ID = 'plan-1';
export const USER_ID = 'user-1';
export const ORG_ID = 'org-1';
export const STEP_LANGUAGE = 'English|en';
export const STEP_BCP47 = 'en';
/** Named-region bucket PBT stores its boundaries in. */
export const BT_REGION_NAME = phraseBtBoundaryRegionName(STEP_BCP47);

/** Fake S3 host the intercepted POST hands back for the audio PUT. */
const FAKE_AUDIO_HOST = 'https://pbt-test.invalid';

// ---------------------------------------------------------------------------
// fake server
// ---------------------------------------------------------------------------

export interface PostedTake {
  /** JSON string exactly as the client posted it (the assertion target). */
  sourceSegments: string;
  parsedSegments: { start?: number; end?: number } | undefined;
  performedBy: string | null;
  languagebcp47: string;
  originalFile: string;
  /** Remote (numeric, string form) id the fake server assigned. */
  remoteId: string;
  /** Orbit id of the mediafile the harness created for this take (once created). */
  mediaId?: string;
}

interface ServerState {
  takes: PostedTake[];
  /** When set, the POST fails with this status (upload rejection paths). */
  failPostWithStatus?: number;
  /** When set, the audio PUT fails with this status. */
  failPutWithStatus?: number;
  /** Delay before the new take becomes visible in Memory/rowData (ms). */
  rowDataLagMs: number;
  /** Delay on the audio PUT - widens the "save in flight" window. */
  putDelayMs: number;
  /** Delay on the take's fileurl GET - widens the "load in flight" window. */
  fileurlDelayMs: number;
  nextRemoteId: number;
  /** Registered by the mounted harness so the "server" can add records. */
  addTakeToMemory?: (take: PostedTake) => void;
  /**
   * Bumped by every reset. A lagged write captures the value and refuses to run
   * against a later mount: a rowDataLagMs timer outlives its own test, and
   * writing a phantom take into the NEXT test's memory made whichever test
   * followed fail in a way that looked like cross-test audio flake.
   */
  generation: number;
  /** Outstanding lagged writes, so a reset can cancel them. */
  pendingTimers: ReturnType<typeof setTimeout>[];
  /** ids requested through GET /mediafiles/:id/fileurl (in request order). */
  fileurlRequestedIds: string[];
}

const serverState: ServerState = {
  takes: [],
  rowDataLagMs: 0,
  putDelayMs: 0,
  fileurlDelayMs: 0,
  nextRemoteId: 1000,
  generation: 0,
  pendingTimers: [],
  fileurlRequestedIds: [],
};

/** Reset the fake server. Call from beforeEach before installing intercepts. */
export function resetPbtServer(options?: {
  rowDataLagMs?: number;
  putDelayMs?: number;
  fileurlDelayMs?: number;
  failPostWithStatus?: number;
  failPutWithStatus?: number;
}) {
  serverState.pendingTimers.forEach(clearTimeout);
  serverState.pendingTimers = [];
  serverState.generation += 1;
  serverState.takes = [];
  serverState.fileurlRequestedIds = [];
  serverState.nextRemoteId = 1000;
  serverState.putDelayMs = options?.putDelayMs ?? 0;
  serverState.fileurlDelayMs = options?.fileurlDelayMs ?? 0;
  serverState.rowDataLagMs = options?.rowDataLagMs ?? 0;
  serverState.failPostWithStatus = options?.failPostWithStatus;
  serverState.failPutWithStatus = options?.failPutWithStatus;
  serverState.addTakeToMemory = undefined;
}

/** Everything the fake server saw, in post order. */
export function postedTakes(): PostedTake[] {
  return serverState.takes;
}

/** mediafile ids requested by MediaRecord load calls (GET /mediafiles/:id/fileurl). */
export function fileurlRequestedIds(): string[] {
  return serverState.fileurlRequestedIds;
}

/** Make later uploads fail (used mid-spec for save-failure paths). */
export function failNextUploads(putStatus = 500) {
  serverState.failPutWithStatus = putStatus;
}

export function succeedFurtherUploads() {
  serverState.failPostWithStatus = undefined;
  serverState.failPutWithStatus = undefined;
}

/**
 * Intercepts the endpoints the real upload chain hits. Must run before mount.
 * Also stubs the fileurl lookup MediaRecord makes for an existing take so the
 * recorder can load one without a server.
 */
export function installPbtServer() {
  cy.intercept('POST', '**/api/mediafiles', (req) => {
    if (serverState.failPostWithStatus) {
      req.reply({ statusCode: serverState.failPostWithStatus, body: {} });
      return;
    }
    const attrs =
      (
        req.body as {
          data?: { attributes?: Record<string, unknown> };
        }
      )?.data?.attributes ?? {};
    const remoteId = String(serverState.nextRemoteId++);
    const sourceSegments = String(attrs['source-segments'] ?? '');
    let parsedSegments: { start?: number; end?: number } | undefined;
    try {
      parsedSegments = JSON.parse(sourceSegments || '{}');
    } catch {
      parsedSegments = undefined;
    }
    const take: PostedTake = {
      sourceSegments,
      parsedSegments,
      performedBy: (attrs['performed-by'] as string) ?? null,
      languagebcp47: String(attrs['languagebcp47'] ?? ''),
      originalFile: String(attrs['original-file'] ?? ''),
      remoteId,
    };
    serverState.takes.push(take);
    req.reply({
      statusCode: 201,
      body: {
        data: {
          type: 'mediafiles',
          id: Number(remoteId),
          attributes: {
            ...attrs,
            id: Number(remoteId),
            'audio-url': `${FAKE_AUDIO_HOST}/put/${remoteId}`,
          },
        },
      },
    });
  }).as('createMediafile');

  cy.intercept('PUT', `${FAKE_AUDIO_HOST}/**`, (req) => {
    if (serverState.failPutWithStatus) {
      req.reply({ statusCode: serverState.failPutWithStatus, body: 'nope' });
      return;
    }
    const remoteId = req.url.split('/').pop() ?? '';
    const take = serverState.takes.find((t) => t.remoteId === remoteId);
    // The real pull-after-upload is what makes the take visible; model it
    // (optionally late) so rowData-lag behaviour is reproducible.
    if (take) {
      const gen = serverState.generation;
      const add = () => {
        // Never write into a later test's memory (see ServerState.generation).
        if (serverState.generation !== gen) return;
        serverState.addTakeToMemory?.(take);
      };
      if (serverState.rowDataLagMs > 0) {
        serverState.pendingTimers.push(
          setTimeout(add, serverState.rowDataLagMs)
        );
      } else add();
    }
    req.reply({ statusCode: 200, body: '', delay: serverState.putDelayMs });
  }).as('putAudio');

  // Existing-take load (useFetchUrlNow → GET mediafiles/<id>/fileurl).
  cy.intercept('GET', '**/mediafiles/*/fileurl', (req) => {
    const match = /\/mediafiles\/([^/]+)\/fileurl(?:\?|$)/.exec(req.url);
    if (match?.[1]) {
      serverState.fileurlRequestedIds.push(decodeURIComponent(match[1]));
    }
    req.reply({
      statusCode: 200,
      delay: serverState.fileurlDelayMs,
      body: {
        data: {
          attributes: {
            'audio-url': `${FAKE_AUDIO_HOST}/audio/take.wav`,
          },
        },
      },
    });
  }).as('fileurl');

  // The take audio itself — a short valid WAV.
  cy.intercept('GET', `${FAKE_AUDIO_HOST}/audio/**`, (req) => {
    req.reply({
      statusCode: 200,
      headers: { 'content-type': 'audio/wav' },
      body: buildWavBuffer(2),
    });
  }).as('takeAudio');
}

/**
 * Mono 16-bit PCM WAV bytes: a tone with a short silence around every boundary
 * in `boundaries`. Real speech-like gaps matter — the step's auto-segment runs
 * on silence detection, and region-out only fires cleanly when playback has
 * something to stop against.
 */
function buildWavBuffer(
  seconds: number,
  boundaries: number[] = [],
  sampleRate = 8000
): ArrayBuffer {
  const numSamples = Math.max(1, Math.floor(seconds * sampleRate));
  const dataSize = numSamples * 2;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++)
      view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);
  const SILENCE_HALF_WIDTH = 0.25;
  const silent = (t: number) =>
    t < 0.05 ||
    t > seconds - 0.05 ||
    boundaries.some((b) => Math.abs(t - b) < SILENCE_HALF_WIDTH);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const amp = silent(t) ? 0 : 0.3;
    view.setInt16(
      44 + i * 2,
      Math.floor(Math.sin(2 * Math.PI * 440 * t) * amp * 32767),
      true
    );
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// store / memory
// ---------------------------------------------------------------------------

function createPbtStore() {
  const stringsReducer = () => {
    const initial = localizationReducer(undefined, { type: '@@INIT' });
    return { ...initial, loaded: true, lang: 'en' };
  };
  return createStore(
    combineReducers({
      strings: stringsReducer,
      books: bookReducer,
      orbit: orbitReducer,
      upload: uploadReducer,
      paratext: paratextReducer,
      importexport: exportReducer,
      auth: authReducer,
    }),
    // Explicit undefined preloadedState disambiguates the createStore overload,
    // the same way src/store/index.tsx does.
    undefined,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    applyMiddleware(thunk as any)
  );
}

export interface SegmentSpec {
  start: number;
  end: number;
}

export interface MountPbtOptions {
  /** Segment boundaries pre-seeded on the vernacular's `BT:en` bucket. */
  segments?: SegmentSpec[];
  /** Indices that already have a saved take when the step opens. */
  existingTakes?: number[];
  /** Exact seeded takes for multi-language and duplicate-segment cases. */
  existingTakeRows?: Array<{
    segmentIndex: number;
    languagebcp47: string;
    remoteId: string;
    performedBy?: string;
  }>;
  /** Step language stamped in Step Settings (`Name|bcp47`). */
  stepLanguage?: string;
  /** Source audio length (s). Must cover the last segment end. */
  durationSec?: number;
  /** ms before an uploaded take shows up in rowData (0 = immediate). */
  rowDataLagMs?: number;
  /** ms the audio PUT is held open - keeps a save "in flight" deterministically. */
  putDelayMs?: number;
  /** ms the take's fileurl GET is held open - keeps a load "in flight". */
  fileurlDelayMs?: number;
  /** Reject the mediafile POST with this status (upload-failure paths). */
  failPostWithStatus?: number;
  width?: number;
  /** Speaker pre-filled in localStorage (blank = the highlight-speaker path). */
  speaker?: string;
  /**
   * Times to put silence around in the generated audio. Defaults to the
   * segment boundaries; pass explicit times when `segments` is empty so the
   * step's own auto-segment has something to find.
   */
  audioBoundaries?: number[];
}

const sourceAudioBlob = (seconds: number, boundaries: number[]) =>
  new Blob([buildWavBuffer(seconds, boundaries)], { type: 'audio/wav' });

/** Interior segment boundaries (drops 0 and the final end). */
function interiorBoundaries(
  segments: SegmentSpec[],
  durationSec: number
): number[] {
  if (segments.length === 0) {
    // No preseeded map: evenly spaced gaps so auto-segment finds ~3 segments.
    const step = durationSec / 3;
    return [step, step * 2];
  }
  return segments
    .map((s) => s.start)
    .filter((t) => t > 0.01)
    .concat(segments[segments.length - 1]?.end ?? 0)
    .filter((t) => t > 0.01 && t < durationSec - 0.01);
}

function segmentsAttribute(segments: SegmentSpec[], bcp47: string): string {
  const regions: IRegion[] = segments.map((s) => ({
    start: s.start,
    end: s.end,
    label: '',
  }));
  return JSON.stringify([
    {
      name: phraseBtBoundaryRegionName(bcp47),
      regionInfo: regionsJsonFromList(regions, boldDefaultSegParams),
    },
  ]);
}

function takeRecord(
  id: string,
  remoteId: string,
  sourceSegments: string,
  performedBy: string | null,
  languagebcp47 = STEP_LANGUAGE
): MediaFileD {
  return {
    type: 'mediafile',
    id,
    keys: { remoteId },
    attributes: {
      versionNumber: 1,
      duration: 2,
      contentType: 'audio/ogg',
      originalFile: `${id}.ogg`,
      audioUrl: `${FAKE_AUDIO_HOST}/audio/${id}.wav`,
      sourceSegments,
      languagebcp47,
      performedBy,
      dateCreated: new Date(2026, 0, 1).toISOString(),
      segments: '[]',
    },
    relationships: {
      artifactType: { data: { type: 'artifacttype', id: ARTIFACT_TYPE_ID } },
      passage: { data: { type: 'passage', id: PASSAGE_ID } },
      plan: { data: { type: 'plan', id: PLAN_ID } },
      sourceMedia: { data: { type: 'mediafile', id: VERNACULAR_ID } },
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any as MediaFileD;
}

function seedRecords(memory: Memory, options: MountPbtOptions) {
  const segments = options.segments ?? [];
  const stepLanguage = options.stepLanguage ?? STEP_LANGUAGE;
  const stepBcp47 = parseMediaLanguageBcp47(stepLanguage);
  const stepTool = JSON.stringify({
    tool: 'phraseBackTranslate',
    settings: JSON.stringify({
      language: stepLanguage,
      artifactTypeId: ARTIFACT_TYPE_ID,
    }),
  });
  const records = [
    {
      type: 'user',
      id: USER_ID,
      keys: { remoteId: '1' },
      attributes: { name: 'Tester' },
    },
    {
      type: 'organization',
      id: ORG_ID,
      keys: { remoteId: '1' },
      attributes: { name: 'Org', defaultParams: '{}' },
    },
    {
      type: 'plan',
      id: PLAN_ID,
      keys: { remoteId: '5' },
      attributes: { name: 'Plan' },
    },
    {
      type: 'section',
      id: SECTION_ID,
      keys: { remoteId: '6' },
      attributes: { sequencenum: 1, name: 'Section' },
    },
    {
      type: 'passage',
      id: PASSAGE_ID,
      keys: { remoteId: '7' },
      attributes: { sequencenum: 1, book: 'LUK', reference: '1:1-4' },
      relationships: { section: { data: { type: 'section', id: SECTION_ID } } },
    },
    {
      type: 'artifacttype',
      id: ARTIFACT_TYPE_ID,
      keys: { remoteId: ARTIFACT_TYPE_REMOTE_ID },
      attributes: { typename: 'backtranslation' },
    },
    {
      type: 'orgworkflowstep',
      id: STEP_ID,
      keys: { remoteId: '8' },
      attributes: {
        process: 'OBT',
        name: 'Phrase Back Translate',
        sequencenum: 5,
        tool: stepTool,
      },
      relationships: {
        organization: { data: { type: 'organization', id: ORG_ID } },
      },
    },
    {
      type: 'mediafile',
      id: VERNACULAR_ID,
      keys: { remoteId: VERNACULAR_REMOTE_ID },
      attributes: {
        versionNumber: 1,
        duration: options.durationSec ?? 30,
        contentType: 'audio/wav',
        originalFile: 'vern.wav',
        audioUrl: `${FAKE_AUDIO_HOST}/audio/vern.wav`,
        segments: segmentsAttribute(segments, stepBcp47),
        transcription: '',
      },
      relationships: {
        passage: { data: { type: 'passage', id: PASSAGE_ID } },
        plan: { data: { type: 'plan', id: PLAN_ID } },
      },
    },
  ];

  if ((options.existingTakeRows?.length ?? 0) > 0) {
    options.existingTakeRows?.forEach((row) => {
      const seg = segments[row.segmentIndex];
      if (!seg) return;
      records.push(
        takeRecord(
          `mf-take-${row.remoteId}`,
          row.remoteId,
          JSON.stringify({ start: seg.start, end: seg.end, label: '' }),
          row.performedBy ?? 'Existing Speaker',
          row.languagebcp47
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any
      );
    });
  } else {
    (options.existingTakes ?? []).forEach((idx) => {
      const seg = segments[idx];
      if (!seg) return;
      records.push(
        takeRecord(
          `mf-take-${idx}`,
          String(500 + idx),
          JSON.stringify({ start: seg.start, end: seg.end, label: '' }),
          'Existing Speaker',
          stepLanguage
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ) as any
      );
    });
  }

  memory.cache.update((t) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    records.map((r) => t.addRecord(r as any))
  );
}

function rowFromMediafile(m: MediaFileD, isVernacular: boolean): IRow {
  return {
    id: m.id,
    sequenceNum: 1,
    version: m.attributes?.versionNumber ?? 1,
    mediafile: m,
    playItem: '',
    artifactName: '',
    artifactType: isVernacular ? '' : 'backtranslation',
    artifactCategory: '',
    done: false,
    editAction: null,
    resource: null,
    passageId: PASSAGE_ID,
    isVernacular,
    isResource: false,
    isComment: false,
    isKeyTerm: false,
    isText: false,
    sourceVersion: 1,
  } as IRow;
}

// ---------------------------------------------------------------------------
// the harness component
// ---------------------------------------------------------------------------

export interface PbtHarnessApi {
  /** Latest engine state, for assertions the DOM cannot express. */
  currentSegmentIndex: () => number;
  currentSegment: () => IRegion | undefined;
  recording: () => boolean;
  playing: () => boolean;
  rowCount: () => number;
  stepComplete: () => boolean;
  /** Simulate a waveform region tap: what wavesurfer does on region-click. */
  tapSegment: (index: number) => void;
  segments: () => SegmentSpec[];
}

declare global {
  interface Window {
    __pbt?: PbtHarnessApi;
  }
}

interface HarnessProps {
  options: MountPbtOptions;
  memory: Memory;
  blob: Blob;
}

function PbtHarnessInner({ options, memory, blob }: HarnessProps) {
  const segments = options.segments ?? [];
  const [refresh, setRefresh] = useState(0);
  const [currentSegmentIndex, setCurrentSegmentIndex] = useState(-1);
  const [currentSegmentText, setCurrentSegmentText] = useState('');
  const [currentSegmentSeq, setCurrentSegmentSeq] = useState(0);
  const currentSegmentRef = useRef<IRegion | undefined>(undefined);
  const recordingRef = useRef(false);
  const playingRef = useRef(false);
  const [complete, setComplete] = useState(false);
  const [pdBusy, setPDBusy] = useState(false);
  const segmentsCb = useRef<((segments: string) => void) | undefined>(
    undefined
  );

  const mediafiles = useMemo(
    () => memory.cache.query((q) => q.findRecords('mediafile')) as MediaFileD[],
    // rebuilt whenever the harness refreshes, mirroring forceRefresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [memory, refresh]
  );

  const rowData = useMemo(
    () => mediafiles.map((m) => rowFromMediafile(m, m.id === VERNACULAR_ID)),
    [mediafiles]
  );

  const playerMediafile = useMemo(
    () => mediafiles.find((m) => m.id === VERNACULAR_ID),
    [mediafiles]
  );

  const forceRefresh = useCallback(() => setRefresh((r) => r + 1), []);

  const setCurrentSegment = useCallback(
    (segment: IRegion | undefined, index: number) => {
      if (
        currentSegmentRef.current !== segment ||
        currentSegmentIndex !== index
      ) {
        currentSegmentRef.current = segment;
        setCurrentSegmentIndex(index);
        // Mirrors the real context: it also publishes the pretty segment string
        // and bumps a change token. Both matter here, because the waveform
        // reports a 1-based index while the step sets a 0-based one, so the
        // index alone can repeat across a real change.
        setCurrentSegmentText(prettySegment(segment));
        setCurrentSegmentSeq((n) => n + 1);
      }
    },
    [currentSegmentIndex]
  );

  const getCurrentSegment = useCallback(() => currentSegmentRef.current, []);

  const tapSegment = useCallback(
    (index: number) => {
      const seg = segments[index];
      if (!seg) return;
      currentSegmentRef.current = { start: seg.start, end: seg.end, label: '' };
      setCurrentSegmentIndex((i) => i + 1);
    },
    [segments]
  );

  useEffect(() => {
    serverState.addTakeToMemory = (take) => {
      const id = `mf-uploaded-${take.remoteId}`;
      take.mediaId = id;
      void memory.cache.update((t) =>
        t.addRecord(
          takeRecord(
            id,
            take.remoteId,
            take.sourceSegments,
            take.performedBy
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ) as any
        )
      );
      forceRefresh();
    };
    return () => {
      serverState.addTakeToMemory = undefined;
    };
  }, [memory, forceRefresh]);

  const api = useMemo<PbtHarnessApi>(
    () => ({
      currentSegmentIndex: () => currentSegmentIndex,
      currentSegment: () => currentSegmentRef.current,
      recording: () => recordingRef.current,
      playing: () => playingRef.current,
      rowCount: () => rowData.length,
      stepComplete: () => complete,
      tapSegment,
      segments: () => segments,
    }),
    [currentSegmentIndex, rowData.length, complete, tapSegment, segments]
  );

  useEffect(() => {
    window.__pbt = api;
  }, [api]);

  const ctxState = useMemo(
    () => ({
      passage: memory.cache.query((q) =>
        q.findRecord({ type: 'passage', id: PASSAGE_ID })
      ),
      section: memory.cache.query((q) =>
        q.findRecord({ type: 'section', id: SECTION_ID })
      ),
      sharedResource: undefined,
      currentstep: STEP_ID,
      mediafileId: VERNACULAR_ID,
      playerMediafile,
      rowData,
      audioBlob: blob,
      loading: false,
      pdBusy,
      setPDBusy,
      playing: playingRef.current,
      setPlaying: (p: boolean) => {
        playingRef.current = p;
      },
      recording: recordingRef.current,
      setRecording: (r: boolean) => {
        recordingRef.current = r;
      },
      currentSegment: currentSegmentText,
      currentSegmentIndex,
      currentSegmentSeq,
      setCurrentSegment,
      getCurrentSegment,
      setupLocate: (cb?: (segments: string) => void) => {
        segmentsCb.current = cb;
      },
      setPlayerSegments: (segs: string) => segmentsCb.current?.(segs),
      discussionMarkers: [],
      handleHighlightDiscussion: () => {},
      isBoldWorkflow: false,
      carefulSpeechSegParams: boldDefaultSegParams,
      setCarefulSpeechSegParams: () => {},
      stepComplete: () => complete,
      setStepComplete: async (_step: string, value: boolean) => {
        setComplete(value);
      },
      forceRefresh,
      refresh,
      index: 0,
      selected: '',
      chooserSize: 48,
      defaultFilename: 'pbt',
      workflow: [],
      psgCompleted: [],
      orgWorkflowSteps: [],
    }),
    [
      memory,
      playerMediafile,
      rowData,
      blob,
      pdBusy,
      currentSegmentIndex,
      currentSegmentText,
      currentSegmentSeq,
      setCurrentSegment,
      getCurrentSegment,
      complete,
      forceRefresh,
      refresh,
    ]
  );

  return (
    <PassageDetailContext.Provider
      value={
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { state: ctxState as any, setState: () => {} } as any
      }
    >
      <PassageDetailPhraseBackTranslate width={options.width ?? 600} />
    </PassageDetailContext.Provider>
  );
}

function createGlobalInit(memory: Memory): GlobalState {
  return {
    coordinator: {
      getSource: (name: string) => (name === 'memory' ? memory : undefined),
    } as unknown as Coordinator,
    errorReporter: {
      notify: () => {},
    } as unknown as GlobalState['errorReporter'],
    fingerprint: 'pbt-fingerprint',
    memory,
    latestVersion: '',
    loadComplete: true,
    offlineOnly: false,
    organization: ORG_ID,
    releaseDate: '',
    user: USER_ID,
    alertOpen: false,
    autoOpenAddMedia: false,
    changed: false,
    connected: true,
    dataChangeCount: 0,
    developer: false,
    enableOffsite: false,
    home: false,
    importexportBusy: false,
    orbitRetries: 0,
    orgRole: undefined,
    plan: PLAN_ID,
    playingMediaId: '',
    progress: 0,
    project: 'project-1',
    projectsLoaded: [],
    projType: '',
    remoteBusy: false,
    saveResult: undefined,
    snackAlert: undefined,
    snackMessage: (<></>) as React.JSX.Element,
    offline: false,
    mobileView: false,
    addStoryOrPassage: false,
  } as unknown as GlobalState;
}

/**
 * Mount the PBT step. Installs the fake server, seeds Memory, and patches the
 * microphone. Follow with waitForPbtReady().
 */
export function mountPbt(options: MountPbtOptions = {}) {
  const segments = options.segments ?? [
    { start: 0, end: 6 },
    { start: 6, end: 12 },
    { start: 12, end: 18 },
  ];
  const opts: MountPbtOptions = { ...options, segments };
  const durationSec =
    opts.durationSec ?? Math.max(...segments.map((s) => s.end), 6) + 2;

  resetPbtServer({
    rowDataLagMs: opts.rowDataLagMs,
    putDelayMs: opts.putDelayMs,
    fileurlDelayMs: opts.fileurlDelayMs,
    failPostWithStatus: opts.failPostWithStatus,
  });
  installPbtServer();

  cy.window().then((win) => {
    win.localStorage.setItem('phraseBackSpeaker', opts.speaker ?? 'Tester');
  });
  cy.installRecordingMocks();

  const memory = new Memory({ schema, keyMap: new RecordKeyMap() });
  seedRecords(memory, { ...opts, durationSec });
  const blob = sourceAudioBlob(
    durationSec,
    opts.audioBoundaries ?? interiorBoundaries(segments, durationSec)
  );

  const orbitCache = new Map<string, unknown[]>();
  const orbitContextValue: IOrbitContext = {
    memory,
    getRecs: (type: string) => orbitCache.get(type) as never,
    setRecs: (type: string, recs: unknown[] | undefined) => {
      if (recs === undefined) orbitCache.delete(type);
      else orbitCache.set(type, recs);
    },
  };
  const store = createPbtStore();

  cy.mount(
    <Provider store={store}>
      <GlobalProvider init={createGlobalInit(memory)}>
        <OrbitContext.Provider value={orbitContextValue}>
          <HotKeyContext.Provider
            value={
              {
                state: {
                  subscribe: () => {},
                  unsubscribe: () => {},
                  localizeHotKey: (key: string) => key,
                },
                setState: () => {},
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              } as any
            }
          >
            <UnsavedProvider>
              <PbtHarnessInner
                options={{ ...opts, durationSec }}
                memory={memory}
                blob={blob}
              />
            </UnsavedProvider>
          </HotKeyContext.Provider>
        </OrbitContext.Provider>
      </GlobalProvider>
    </Provider>
  );
}

/** Waits for the waveform to load and the step to leave `bootstrapping`. */
export function waitForPbtReady() {
  cy.get('#wsAudioWaveform', { timeout: 30000 }).should('exist');
  // The unit label ("Segment: 0:00 - 0:06") only renders once bootstrapped.
  cy.contains(/0:00 - /, { timeout: 30000 }).should('be.visible');
}

// ---------------------------------------------------------------------------
// assertion helpers
// ---------------------------------------------------------------------------

/** Waveform region colours (utils/carefulSpeechSegmentColors). */
export const SEGMENT_COLOR = {
  current: 'rgba(255, 235, 59, 0.5)',
  pending: 'rgba(158, 158, 158, 0.22)',
  completed: 'rgba(76, 175, 80, 0.35)',
} as const;

/**
 * The source waveform's region elements, left to right (so index === segment
 * index). wavesurfer 7 renders regions in a shadow root, unreachable with
 * ordinary selectors, so they are read through the host.
 */
export function regionElements(doc: Document): HTMLElement[] {
  const container =
    doc.querySelector('#detailplayer #wsAudioWaveform') ??
    doc.querySelector('#wsAudioWaveform');
  if (!container) return [];
  const host = Array.from(container.querySelectorAll('*')).find(
    (el) => (el as HTMLElement).shadowRoot
  ) as HTMLElement | undefined;
  const root = host?.shadowRoot;
  if (!root) return [];
  // A rendered region is `part="region region-<id>"`. Match on the exact token
  // so the plugin's own `regions-container` and `region-handle-*` elements are
  // not counted as segments.
  return (
    Array.from(root.querySelectorAll('[part]')).filter((el) =>
      (el.getAttribute('part') ?? '').split(/\s+/).includes('region')
    ) as HTMLElement[]
  ).sort(
    (a, b) => parseFloat(a.style.left || '0') - parseFloat(b.style.left || '0')
  );
}

/** Background colour of each source-waveform region, left to right. */
function readSegmentColors(doc: Document): string[] {
  return regionElements(doc).map((el) => el.style.backgroundColor);
}

/** Index of the segment currently painted as selected, or -1. */
export function readCurrentSegmentIndex(doc: Document): number {
  return readSegmentColors(doc).findIndex((c) => c === SEGMENT_COLOR.current);
}

/**
 * Index of the segment the step says it is on, read from the "Segment: m:ss -
 * m:ss" label. The waveform paints from currentSegmentIndex while the label
 * comes from the step's own currentIndex, so comparing the two catches the
 * desync where the selection moves but the step does not follow.
 */
export function readLabelSegmentIndex(
  doc: Document,
  segments: SegmentSpec[]
): number {
  const text =
    Array.from(doc.querySelectorAll('p'))
      .map((p) => p.textContent ?? '')
      .find((t) => /Segment:\s*\d+:\d\d\s*-\s*\d+:\d\d/.test(t)) ?? '';
  const match = /Segment:\s*(\d+):(\d\d)/.exec(text);
  if (!match) return -1;
  const start = Number(match[1]) * 60 + Number(match[2]);
  return segments.findIndex((s) => Math.abs(s.start - start) < 1);
}

/** True while the source player is playing (its button shows Pause). */
export function readSourcePlaying(doc: Document): boolean {
  const play = doc.querySelector('#detailplayer #wsAudioPlay');
  return Boolean(play?.querySelector('svg[data-testid="PauseIcon"]'));
}

/** True while the docked Record control is operable. */
export function readRecordEnabled(doc: Document): boolean {
  const rec = doc.querySelector(PBT.recordButton);
  return Boolean(rec) && rec?.getAttribute('aria-disabled') === 'false';
}

/** True while the step is dropping waveform clicks (recording, or saving a take). */
export function readSegmentSelectionLocked(doc: Document): boolean {
  const box = doc.querySelector(`#${PBT.container}`);
  return box?.getAttribute('data-segment-selection-locked') === 'true';
}

/**
 * Wait until a waveform click can actually be received.
 *
 * useWavesurferRegions.handleRegionClick returns early - silently, with no
 * retry and no signal - while lockSegmentSelection is up. A click dispatched
 * inside that window is gone for good, so the assertion that follows can only
 * time out. Clicking mid-save is not what any of these specs are about; it is
 * an unintended precondition, so wait it out before dispatching.
 */
export function waitForSegmentSelectionUnlocked() {
  cy.get(`#${PBT.container}`, { timeout: 30000 }).should(
    'have.attr',
    'data-segment-selection-locked',
    'false'
  );
}

/**
 * Dispatch one click on a segment, the way a user selects one. The region lives
 * in wavesurfer's shadow root, so this dispatches the click the plugin listens
 * for rather than going through cy.click (which cannot reach it).
 *
 * Deliberately ONE click: several specs here exist to catch a first click that
 * is only half applied ("the user had to click again"), and a retry would hide
 * exactly that. Use clickSegmentUntilSelected when reaching the segment is
 * setup rather than the assertion.
 */
export function clickSegmentOnWaveform(index: number) {
  waitForSegmentSelectionUnlocked();
  cy.document().then((doc) => {
    const el = regionElements(doc)[index];
    expect(el, `waveform region ${index} exists`).to.not.equal(undefined);
    const view = el.ownerDocument.defaultView as Window & typeof globalThis;
    el.dispatchEvent(new view.MouseEvent('click', { bubbles: true }));
  });
}

/**
 * Click a segment until the step reports it as current.
 *
 * For specs where getting to a segment is setup and the assertion is about
 * something later. Do NOT use it where the first click IS the subject - it
 * would turn "the click was swallowed" into a pass. Clicks are spaced past
 * useWavesurferRegions' 100ms same-region debounce, which would drop a
 * faster retry.
 */
export function clickSegmentUntilSelected(
  index: number,
  segments: SegmentSpec[],
  options: { attempts?: number; spacingMs?: number } = {}
) {
  const { attempts = 8, spacingMs = 250 } = options;
  const attempt = (left: number) => {
    cy.document().then((doc) => {
      if (readLabelSegmentIndex(doc, segments) === index) return;
      expect(
        left,
        `segment ${index} selected within ${attempts} clicks`
      ).to.be.greaterThan(0);
      if (!readSegmentSelectionLocked(doc)) {
        const el = regionElements(doc)[index];
        expect(el, `waveform region ${index} exists`).to.not.equal(undefined);
        const view = el.ownerDocument.defaultView as Window & typeof globalThis;
        el.dispatchEvent(new view.MouseEvent('click', { bubbles: true }));
      }
      cy.wait(spacingMs, { log: false });
      attempt(left - 1);
    });
  };
  attempt(attempts);
}

/**
 * Report a segment change from the engine with no click behind it - what a
 * spurious `region-in` looks like to the step (playback overshooting the clause
 * end, or the recorder mounting once Record is allowed).
 *
 * Asserts the harness API and the segment are really there, and that the tap
 * reached the engine, so a renamed or missing `__pbt` fails here rather than
 * turning the caller into a silent no-op that every later assertion passes.
 */
export function tapSegmentOnEngine(index: number) {
  cy.window().then((win) => {
    const api = win.__pbt;
    expect(api, 'pbt harness api is exposed').to.not.equal(undefined);
    const pbt = api as PbtHarnessApi;
    expect(
      pbt.segments()[index],
      `harness segment ${index} exists`
    ).to.not.equal(undefined);
    const before = pbt.currentSegmentIndex();
    pbt.tapSegment(index);
    cy.window().should((w) => {
      expect(
        (w.__pbt as PbtHarnessApi).currentSegmentIndex(),
        'the tap reached the engine'
      ).to.not.equal(before);
    });
  });
}

/**
 * Poll the DOM and return every sample. Transient states — a colour that
 * flashes onto the wrong segment for one frame, a button that is briefly
 * operable — are invisible to ordinary retrying assertions, which only ever see
 * the settled value. Sampling catches them.
 */
export function sampleDom<T>(
  collect: (doc: Document) => T,
  options: {
    forMs: number;
    everyMs?: number;
    stopWhen?: (sample: T) => boolean;
  }
): Cypress.Chainable<T[]> {
  const { forMs, everyMs = 25, stopWhen } = options;
  // The timeout belongs on .then(): it is the callback's returned promise that
  // has to outlive the sampling window, and that defaults to 4s.
  return cy.window({ log: false }).then(
    { timeout: forMs + 10000 },
    (win) =>
      new Cypress.Promise<T[]>((resolve) => {
        const samples: T[] = [];
        const startedAt = Date.now();
        const timer = win.setInterval(() => {
          const sample = collect(win.document);
          samples.push(sample);
          if (stopWhen?.(sample) || Date.now() - startedAt > forMs) {
            win.clearInterval(timer);
            resolve(samples);
          }
        }, everyMs);
      })
  );
}

/** One-shot read — use the expect* helpers below when the value may still settle. */
export function segmentColors(): Cypress.Chainable<string[]> {
  return cy.document().then((doc) => readSegmentColors(doc));
}

/**
 * Retrying colour assertion. Colours are repainted by an effect after the state
 * that drives them, so a one-shot read races the repaint.
 */
export function expectSegmentColors(expected: string[]) {
  cy.document().then((doc) => {
    cy.wrap(null, { timeout: 15000, log: false }).should(() => {
      expect(readSegmentColors(doc), 'segment colours').to.deep.equal(expected);
    });
  });
}

/** Retrying segment-count assertion. */
export function expectSegmentCount(count: number) {
  cy.document().then((doc) => {
    cy.wrap(null, { timeout: 15000, log: false }).should(() => {
      expect(readSegmentColors(doc), 'segment count').to.have.length(count);
    });
  });
}

/** Playhead position as the user sees it ("0:07"). */
export function playheadText(): Cypress.Chainable<string> {
  return cy.get('#detailplayer #wsAudioPosition').invoke('text');
}

/** Seconds parsed from a m:ss / h:mm:ss duration label. */
export function parseTime(text: string): number {
  const parts = text
    .trim()
    .split(':')
    .map((p) => parseInt(p, 10));
  if (parts.length === 3)
    return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  return parts[0] ?? 0;
}

export function expectRecordEnabled() {
  cy.get(PBT.recordButton, { timeout: 20000 }).should(
    'have.attr',
    'aria-disabled',
    'false'
  );
}

export function expectRecordDisabled() {
  cy.get(PBT.recordButton).should('have.attr', 'aria-disabled', 'true');
}

/** True when the recorder is showing a take (Clear Recording is offered). */
export function expectTakePresent() {
  cy.get('[aria-label="Clear Recording"]', { timeout: 20000 }).should('exist');
}

export function expectNoTakePresent() {
  cy.get('[aria-label="Clear Recording"]').should('not.exist');
}

/** Record for `ms`, then stop. Assumes Record is already enabled. */
export function recordTake(ms = 1200) {
  expectRecordEnabled();
  cy.get(PBT.recordButton).click();
  // StopIcon means capture really started (not just a click that did nothing).
  cy.get(`${PBT.dockedRecord} svg[data-testid="StopIcon"]`, {
    timeout: 15000,
  }).should('exist');
  cy.wait(ms);
  cy.get(PBT.recordButton).click();
}

/** Wait until the fake server has seen `count` uploads. */
export function waitForUploads(count: number) {
  cy.wrap(null, { timeout: 30000 }).should(() => {
    expect(postedTakes().length, 'uploads posted').to.equal(count);
  });
}

/**
 * Releases the AudioContext installRecordingMocks created for this test.
 * Browsers cap live AudioContexts per document and a CT spec shares one
 * document across every test, so leaking them makes later tests fail to decode.
 */
export function pbtCleanup() {
  cy.window({ log: false }).then((win) => {
    const ctx = win.__recordingMock?.audioContext;
    if (ctx && ctx.state !== 'closed') void ctx.close();
  });
}

/**
 * Waits until the recorder is neither saving nor loading, so a following
 * navigation is a clean user action rather than a race. Use it when the test
 * is about something else; leave it out when the race IS the test.
 *
 * The status-text check alone is not a barrier. It is a `.should()` that passes
 * on its FIRST evaluation, so sampling the gap before React paints "Saving"
 * lets it through with the save still in flight - and the text is cleared by
 * MediaRecord's own effects while savingRecording is cleared by onSaveSettled
 * (its onReady), two paths that can land in either order. waitForUploads only
 * gets us as far as the POST; the PUT and onReady come after. So wait on the
 * flag that actually gates input, and only then on the text.
 */
export function waitForRecorderIdle() {
  waitForSegmentSelectionUnlocked();
  cy.get(`#${PBT.container}`, { timeout: 30000 }).should(($el) => {
    expect($el.text(), 'recorder idle').to.not.match(/Saving|Loading/);
  });
}

/** Region a take was saved against, as {start, end}. */
export function takeSegment(index: number) {
  const take = postedTakes()[index];
  return take?.parsedSegments;
}

// ---------------------------------------------------------------------------
// shared spec drivers
// ---------------------------------------------------------------------------

/** Three 3s segments in 11s of audio - long enough to observe, short to run. */
export const SEGMENTS_3: SegmentSpec[] = [
  { start: 0, end: 3 },
  { start: 3, end: 6 },
  { start: 6, end: 9 },
];

/** The "Segment: 0:00 - 0:03" label under the waveform. */
export const unitLabel = (start: string, end: string) =>
  cy.contains(`Segment: ${start} - ${end}`, { timeout: 20000 });

/** The source player's play/pause button (the recorder has one too). */
export const sourcePlay = () => cy.get('#detailplayer #wsAudioPlay');

/** Enter the recording pass and wait for the first segment's auto-play to park. */
export const startRecordingPass = () => {
  cy.get(PBT.start).click();
  expectRecordEnabled();
};

/** Record a take on the current segment and let the save and load finish. */
export const recordAndSettle = (uploadCount: number) => {
  recordTake();
  waitForUploads(uploadCount);
  waitForRecorderIdle();
};
