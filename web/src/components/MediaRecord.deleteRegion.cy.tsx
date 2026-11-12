/**
 * Delete Region integration — TT-7138
 *
 * Record step: select a waveform region and click Delete Region.
 * Unfixed wsRegionDelete can throw when region.end exceeds buffer length
 * (media duration vs AudioBuffer), clearing the selection without trimming.
 * A beyond-buffer-only selection can also arm Undo / mark changed with no
 * audio mutation — assert Undo stays off and duration is unchanged.
 * Assert waveform-backed duration shrinks for real deletes.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';

import bugsnagClient from '../auth/bugsnagClient';
import { GlobalProvider, GlobalState } from '../context/GlobalContext';
import { UnsavedContext } from '../context/UnsavedContext';
import { PassageDetailContext } from '../context/PassageDetailContext';
import { HotKeyContext } from '../context/HotKeyContext';
import { IOrbitContext } from '../hoc/OrbitContext';
import { OrbitContext } from '../hoc/OrbitContextProvider';
import localizationReducer from '../store/localization/reducers';
import bookReducer from '../store/book/reducers';
import MediaRecord from './MediaRecord';
import type { WSAudioPlayerControls } from './WSAudioPlayer';
import { RECORD_PREVIEW_TIMESLICE_MS } from '../../cypress/support/recordingMocks';
import { CAPTURE_DEVICE_LOSS_RETRY_MS } from '../crud/captureConstraints';

const mockStore = createStore(
  combineReducers({
    strings: () => {
      const initialState = localizationReducer(undefined, { type: '@@INIT' });
      return { ...initialState, loaded: true, lang: 'en' };
    },
    books: bookReducer,
  })
);

type RecordsByType = Record<string, unknown[]>;

const createMockQueryBuilder = (recordsByType: RecordsByType) => {
  const makeRecordSet = (type: string) => {
    const records = [...(recordsByType[type] ?? [])] as unknown[] & {
      filter: (arg: unknown) => unknown[];
    };
    const arrayFilter = Array.prototype.filter.bind(records) as (
      fn: (rec: unknown) => boolean
    ) => unknown[];
    records.filter = (arg: unknown) => {
      if (arg && typeof arg === 'object' && 'attribute' in arg) {
        const { attribute, value } = arg as {
          attribute: string;
          value: unknown;
        };
        return arrayFilter(
          (rec) =>
            (rec as { attributes?: Record<string, unknown> })?.attributes?.[
              attribute
            ] === value
        );
      }
      return arrayFilter(arg as (rec: unknown) => boolean);
    };
    return records;
  };

  return {
    findRecords: (type: string) => makeRecordSet(type),
    findRecord: (identity: { type: string; id: string }) =>
      (recordsByType[identity.type] ?? []).find(
        (rec) => (rec as { id: string }).id === identity.id
      ),
  };
};

const createMockMemory = (recordsByType: RecordsByType = {}): Memory => {
  const builder = createMockQueryBuilder(recordsByType);
  return {
    cache: {
      query: (
        queryFn: (q: ReturnType<typeof createMockQueryBuilder>) => unknown
      ) => queryFn(builder),
      liveQuery: (
        queryFn: (q: ReturnType<typeof createMockQueryBuilder>) => unknown
      ) => ({
        subscribe: () => () => {},
        query: () => queryFn(builder),
      }),
    },
    update: () => {},
    keyMap: {
      idToKey: (_t: string, _a: string, id: string) => id,
      keyToId: (_t: string, _a: string, id: string) => id,
    },
  } as unknown as Memory;
};

const createInitialState = (memory: Memory): GlobalState => ({
  coordinator: {
    getSource: (name: string) => (name === 'memory' ? memory : {}),
  } as unknown as Coordinator,
  errorReporter: bugsnagClient,
  fingerprint: 'test-fingerprint',
  memory,
  latestVersion: '',
  loadComplete: false,
  offlineOnly: false,
  organization: 'org-1',
  releaseDate: '',
  user: 'user-1',
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
  plan: 'plan-1',
  playingMediaId: '',
  progress: 0,
  project: '',
  projectsLoaded: [],
  projType: '',
  remoteBusy: false,
  saveResult: undefined,
  snackAlert: undefined,
  snackMessage: (<></>) as React.JSX.Element,
  offline: false,
  mobileView: true,
  addStoryOrPassage: false,
});

const theme = createTheme({
  palette: {
    custom: {
      currentRegion: 'rgba(0, 200, 0, 0.25)',
    },
  } as never,
});

const waitForRecordReady = () => {
  cy.get('#wsAudioRecord', { timeout: 15000 }).should(
    'not.have.attr',
    'aria-disabled',
    'true'
  );
};

let clockArmed = false;

const startRecording = () => {
  waitForRecordReady();
  cy.then(() => {
    if (!clockArmed) {
      clockArmed = true;
      cy.clock();
    }
  });
  cy.get('#wsAudioRecord').click();
  cy.tick(CAPTURE_DEVICE_LOSS_RETRY_MS + 100);
  cy.get('svg[data-testid="PauseIcon"]', { timeout: 15000 }).should(
    'be.visible'
  );
  cy.tick(100);
};

const advanceRecordingTicks = (count: number) => {
  for (let i = 0; i < count; i++) {
    cy.tick(RECORD_PREVIEW_TIMESLICE_MS);
  }
};

const pauseRecording = () => {
  cy.get('svg[data-testid="PauseIcon"]', { timeout: 10000 }).should(
    'be.visible'
  );
  cy.get('#wsAudioRecord').click();
  cy.tick(200);
};

const parseDurationText = (text: string): number => {
  const parts = text
    .trim()
    .split(':')
    .map((p) => parseInt(p, 10));
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
};

const assertWaveformDurationAtLeast = (minSeconds: number) => {
  cy.get('#wsAudioDuration', { timeout: 10000 })
    .invoke('text')
    .should((text) => {
      expect(parseDurationText(text)).to.be.at.least(minSeconds);
    });
};

type WsCtSeam = {
  currentRegion: () => { start: number; end: number } | undefined;
  blobDuration: () => number;
};

/** Select an end region via controlsRef, then overshoot end past the buffer (TT-7138). */
const selectEndRegionViaControls = (
  controlsRef: React.RefObject<WSAudioPlayerControls | null>,
  startFrac: number
) => {
  cy.then(() => {
    if (clockArmed) {
      cy.clock().then((clock) => clock.restore());
      clockArmed = false;
    }
  });

  cy.window().should((win) => {
    expect(
      (win as Window & { __wsCt?: WsCtSeam }).__wsCt,
      'Cypress WaveSurfer CT seam'
    ).to.exist;
  });

  cy.then(() => {
    const dur = controlsRef.current?.getDuration() ?? 0;
    expect(dur, 'duration before region select').to.be.greaterThan(5);
    const start = dur * startFrac;
    controlsRef.current?.loadRegionsJson?.(
      JSON.stringify({
        params: {},
        regions: [{ start, end: dur }],
      })
    );
  });

  cy.get('#wsAudioDeleteRegion', { timeout: 10000 }).should('be.visible');

  // Media-element duration can exceed AudioBuffer length; force that overshoot
  // so Delete Region hits the unclamped endSample path without relying on flaky DnD.
  cy.window().then((win) => {
    const seam = (win as Window & { __wsCt?: WsCtSeam }).__wsCt;
    const region = seam?.currentRegion();
    expect(region, 'current region after loadRegionsJson').to.exist;
    const bufDur = seam!.blobDuration();
    region!.end = Math.max(region!.end, bufDur) + 0.05;
  });
};

/** Select a middle region via controlsRef (no overshoot — common-path regression). */
const selectMiddleRegionViaControls = (
  controlsRef: React.RefObject<WSAudioPlayerControls | null>
) => {
  cy.then(() => {
    if (clockArmed) {
      cy.clock().then((clock) => clock.restore());
      clockArmed = false;
    }
  });

  cy.then(() => {
    const dur = controlsRef.current?.getDuration() ?? 0;
    expect(dur, 'duration before middle region select').to.be.greaterThan(5);
    const start = dur * 0.3;
    const end = dur * 0.6;
    controlsRef.current?.loadRegionsJson?.(
      JSON.stringify({
        params: {},
        regions: [{ start, end }],
      })
    );
  });

  cy.get('#wsAudioDeleteRegion', { timeout: 10000 }).should('be.visible');
};

/** Select a region entirely past the decoded buffer (phantom media-tail selection). */
const selectBeyondBufferRegionViaControls = (
  controlsRef: React.RefObject<WSAudioPlayerControls | null>
) => {
  cy.then(() => {
    if (clockArmed) {
      cy.clock().then((clock) => clock.restore());
      clockArmed = false;
    }
  });

  cy.window().should((win) => {
    expect(
      (win as Window & { __wsCt?: WsCtSeam }).__wsCt,
      'Cypress WaveSurfer CT seam'
    ).to.exist;
  });

  cy.then(() => {
    const dur = controlsRef.current?.getDuration() ?? 0;
    expect(dur, 'duration before beyond-buffer select').to.be.greaterThan(5);
    // Seed a real region so Delete Region is enabled, then move it past the buffer.
    controlsRef.current?.loadRegionsJson?.(
      JSON.stringify({
        params: {},
        regions: [{ start: dur * 0.9, end: dur }],
      })
    );
  });

  cy.get('#wsAudioDeleteRegion', { timeout: 10000 }).should('be.visible');

  cy.window().then((win) => {
    const seam = (win as Window & { __wsCt?: WsCtSeam }).__wsCt;
    const region = seam?.currentRegion();
    expect(region, 'current region after loadRegionsJson').to.exist;
    const bufDur = seam!.blobDuration();
    expect(bufDur, 'decoded buffer duration').to.be.greaterThan(0);
    // Entire selection past decoded samples (Devin: startSample > length).
    region!.start = bufDur + 0.01;
    region!.end = bufDur + 0.05;
  });
};

const mountMediaRecord = (
  props: Partial<React.ComponentProps<typeof MediaRecord>> = {}
) => {
  const memory = createMockMemory({
    artifacttype: [
      {
        id: 'at-vernacular',
        type: 'artifacttype',
        attributes: { typename: 'vernacular' },
      },
    ],
  });
  const orbitCache = new Map<string, unknown[]>();
  const orbitContextValue: IOrbitContext = {
    memory,
    getRecs: (type: string) => orbitCache.get(type) as never,
    setRecs: (type: string, recs: unknown[] | undefined) => {
      if (recs === undefined) orbitCache.delete(type);
      else orbitCache.set(type, recs);
    },
  };
  const unsavedState = {
    startSave: cy.stub(),
    toolChanged: cy.stub(),
    toolsChanged: {},
    saveRequested: () => false,
    clearRequested: () => false,
    clearCompleted: cy.stub(),
    waitForSave: (cb: () => void) => cb(),
    saveCompleted: cy.stub(),
  };

  const passageDetailState = {
    passage: { id: 'pass-1', type: 'passage' },
    sharedResource: undefined,
    mediafileId: '',
    chooserSize: 48,
    recording: false,
    setRecording: cy.stub(),
    currentstep: 'record',
    isBoldWorkflow: false,
  };

  const defaults: React.ComponentProps<typeof MediaRecord> = {
    toolId: 'record-tool',
    artifactId: 'vernacular',
    passageId: 'passage-1',
    afterUploadCb: cy.stub().as('afterUploadCb'),
    defaultFilename: 'recording',
    setCanSave: cy.stub().as('setCanSave'),
    setStatusText: cy.stub(),
    width: 400,
    allowRecord: true,
    forceMobileView: true,
    handleSave: cy.stub().as('handleSave'),
    showSize: false,
  };

  cy.viewport(480, 800);

  cy.mount(
    <Provider store={mockStore}>
      <ThemeProvider theme={theme}>
        <GlobalProvider init={createInitialState(memory)}>
          <OrbitContext.Provider value={orbitContextValue}>
            <UnsavedContext.Provider
              value={{
                state: unsavedState as never,
                setState: cy.stub() as never,
              }}
            >
              <HotKeyContext.Provider
                value={{
                  state: {
                    subscribe: () => {},
                    unsubscribe: () => {},
                    localizeHotKey: (key: string) => key,
                  } as never,
                  setState: cy.stub() as never,
                }}
              >
                <PassageDetailContext.Provider
                  value={{
                    state: passageDetailState as never,
                    setState: cy.stub() as never,
                  }}
                >
                  <MediaRecord {...defaults} {...props} />
                </PassageDetailContext.Provider>
              </HotKeyContext.Provider>
            </UnsavedContext.Provider>
          </OrbitContext.Provider>
        </GlobalProvider>
      </ThemeProvider>
    </Provider>
  );
};

describe('MediaRecord delete region — TT-7138', { tags: '@recording' }, () => {
  beforeEach(() => {
    clockArmed = false;
    cy.installRecordingMocks({
      forceMediaRecorderFallback: true,
      useMockMediaRecorder: true,
    });
  });

  afterEach(() => {
    cy.mount(<></>);
    cy.clock().then((clock) => clock.restore());
    cy.window({ log: false }).then((win) => {
      const ctx = win.__recordingMock?.audioContext;
      if (ctx && ctx.state !== 'closed') void ctx.close();
    });
  });

  it('removes the end portion when Delete Region is clicked', () => {
    const controlsRef = React.createRef<WSAudioPlayerControls | null>();
    mountMediaRecord({ controlsRef });

    startRecording();
    advanceRecordingTicks(10);
    pauseRecording();
    cy.tick(500);
    assertWaveformDurationAtLeast(8);

    cy.get('#wsAudioDuration')
      .invoke('text')
      .then((beforeText) => {
        const before = parseDurationText(beforeText);

        selectEndRegionViaControls(controlsRef, 0.65);

        cy.get('#wsAudioDeleteRegion').click();

        cy.get('#wsAudioDuration', { timeout: 10000 })
          .invoke('text')
          .should((afterText) => {
            const after = parseDurationText(afterText);
            expect(after, 'duration after end delete').to.be.lessThan(before);
            expect(before - after, 'trimmed at least ~2s').to.be.at.least(2);
          });
      });
  });

  it('removes a middle portion when Delete Region is clicked', () => {
    const controlsRef = React.createRef<WSAudioPlayerControls | null>();
    mountMediaRecord({ controlsRef });

    startRecording();
    advanceRecordingTicks(10);
    pauseRecording();
    cy.tick(500);
    assertWaveformDurationAtLeast(8);

    cy.get('#wsAudioDuration')
      .invoke('text')
      .then((beforeText) => {
        const before = parseDurationText(beforeText);

        selectMiddleRegionViaControls(controlsRef);

        cy.get('#wsAudioDeleteRegion').click();

        cy.get('#wsAudioDuration', { timeout: 10000 })
          .invoke('text')
          .should((afterText) => {
            const after = parseDurationText(afterText);
            expect(after, 'duration after middle delete').to.be.lessThan(
              before
            );
            expect(before - after, 'trimmed at least ~2s').to.be.at.least(2);
          });
      });
  });

  it('does not mark audio edited when Delete Region is past the decoded buffer', () => {
    const controlsRef = React.createRef<WSAudioPlayerControls | null>();
    mountMediaRecord({ controlsRef });

    startRecording();
    advanceRecordingTicks(10);
    pauseRecording();
    cy.tick(500);
    assertWaveformDurationAtLeast(8);

    // Unfreeze before region setup — pending ready handlers can bump duration.
    cy.then(() => {
      if (clockArmed) {
        cy.clock().then((clock) => clock.restore());
        clockArmed = false;
      }
    });

    selectBeyondBufferRegionViaControls(controlsRef);

    // Capture duration only after region seeding settles.
    cy.get('#wsAudioDuration')
      .invoke('text')
      .then((beforeText) => {
        const before = parseDurationText(beforeText);
        expect(before).to.be.at.least(8);

        cy.get('#wsAudioDeleteRegion').click();

        // Phantom tail: no samples deleted — duration stays put.
        cy.get('#wsAudioDuration', { timeout: 10000 })
          .invoke('text')
          .should((afterText) => {
            expect(parseDurationText(afterText)).to.equal(before);
          });

        // Undo must still restore the pre-record buffer. A buggy delete
        // overwrites undo with the current take, so Undo becomes a no-op.
        cy.get('#wsUndo').should('be.visible').click();
        cy.get('#wsAudioDuration', { timeout: 10000 })
          .invoke('text')
          .should((afterUndoText) => {
            expect(
              parseDurationText(afterUndoText),
              'undo restores pre-record take'
            ).to.be.lessThan(2);
          });
      });
  });
});
