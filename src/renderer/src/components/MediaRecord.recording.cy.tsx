/**
 * Recording integration tests — TT-7276 / TT-7384
 *
 * Exercises MediaRecord → WSAudioPlayer → useWaveSurfer → save gating with real
 * components and browser-level recording mocks (no WSAudioPlayer stub).
 * Device-loss recovery uses the same stack through recorder shutdown, waveform
 * insert, and Save (not the isolated finalizeRecordingOnDeviceLoss unit tests).
 *
 * Repro strategy: force the MediaRecorder fallback path (no AudioWorklet) with
 * MockMediaRecorder that emits one-second fragments each preview tick. Unfixed
 * production forwards concatenated chunks as one Blob — only the first fragment
 * decodes, so Save may appear with ~1s audio while the timer shows the full take.
 * Assertions require waveform-backed duration to match ticks recorded (red without
 * the AudioMediaRecorder merge / stop pipeline fix).
 *
 * Future E2E smoke (deferred): login → Record step → Luke 4:1–13 → pause → save.
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

const startRecording = () => {
  clickRecordButton();
  cy.get('svg[data-testid="PauseIcon"]', { timeout: 15000 }).should(
    'be.visible'
  );
  // recorder.start() is async; under cy.clock() flush before preview ticks.
  cy.tick(100);
};

const clickRecordButton = () => {
  cy.get('body').then(($body) => {
    if ($body.find('svg[data-testid="PauseIcon"]').length > 0) {
      cy.get('svg[data-testid="PauseIcon"]').closest('[role="button"]').click();
      return;
    }
    if ($body.find('#wsAudioRecordTip').length > 0) {
      cy.get('#wsAudioRecordTip').find('[role="button"]').click();
      return;
    }
    // forceMobileView: record control is below the waveform stack
    cy.get('#wsAudioWaveform')
      .closest('.MuiStack-root')
      .parent()
      .children()
      .last()
      .find('[role="button"]')
      .click();
  });
};

const waitForRecordReady = () => {
  cy.get('#wsAudioWaveform', { timeout: 15000 }).should('be.visible');
  cy.get('#wsAudioWaveform')
    .closest('.MuiStack-root')
    .parent()
    .children()
    .last()
    .find('[role="button"]')
    .should('not.have.attr', 'aria-disabled', 'true');
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
  clickRecordButton();
  // AudioMediaRecorder.stop() waits 100ms for final chunks (frozen under cy.clock).
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

const assertSaveReady = () => {
  cy.tick(500);
  cy.get('#rec-save', { timeout: 10000 }).should('be.visible');
  cy.get('#rec-save').should('not.be.disabled');
  cy.get('#wsAudioPlay').should('not.be.disabled');
  cy.get('@setCanSave').should('have.been.called');
  cy.get('@setCanSave')
    .invoke('getCalls')
    .then((calls) => {
      const last = calls[calls.length - 1];
      expect(last.args[0]).to.equal(true);
    });
};

/** Waveform-backed duration after stop (timer alone can show the full take). */
const assertWaveformDurationAtLeast = (minSeconds: number) => {
  cy.get('#wsAudioDuration', { timeout: 10000 })
    .invoke('text')
    .should((text) => {
      expect(parseDurationText(text)).to.be.at.least(minSeconds);
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

describe('MediaRecord recording integration', { tags: '@recording' }, () => {
  beforeEach(() => {
    // Oscillator tracks often start muted. Let that settle with real timers
    // before cy.clock() freezes the 250ms acquire wait.
    cy.installRecordingMocks({
      forceMediaRecorderFallback: true,
      useMockMediaRecorder: true,
    });
    cy.wait(CAPTURE_DEVICE_LOSS_RETRY_MS + 50);
    cy.clock();
  });

  afterEach(() => {
    cy.mount(<></>);
    cy.clock().then((clock) => {
      clock.restore();
    });
  });

  it('shows Save after a short recording is paused (tracer bullet)', () => {
    mountMediaRecord();
    cy.get('#wsAudioWaveform').should('exist');

    startRecording();

    advanceRecordingTicks(3);
    pauseRecording();

    assertSaveReady();
    assertWaveformDurationAtLeast(2);
  });

  it('shows Save after a long recording (~95 preview ticks) — TT-7384', () => {
    mountMediaRecord();
    waitForRecordReady();
    startRecording();

    advanceRecordingTicks(95);
    pauseRecording();

    assertSaveReady();
    assertWaveformDurationAtLeast(90);
  });

  it('advances duration and waveform during long recording — TT-7276', () => {
    mountMediaRecord();
    waitForRecordReady();
    startRecording();

    cy.get('#wsAudioDuration').invoke('text').should('match', /0:0/);

    advanceRecordingTicks(8);

    // Timer path keeps advancing even when preview decode fails (TT-7276 symptom)
    cy.get('#wsAudioDuration')
      .invoke('text')
      .should('not.match', /^0:00$/);

    pauseRecording();
    assertSaveReady();
    assertWaveformDurationAtLeast(7);
  });

  it('shows Save after overdub second recording — TT-7276 scenario 2 core path', () => {
    mountMediaRecord();
    waitForRecordReady();

    // First take
    startRecording();
    advanceRecordingTicks(3);
    pauseRecording();
    assertSaveReady();
    assertWaveformDurationAtLeast(2);

    // Second take (overdub — duration > 0)
    startRecording();
    advanceRecordingTicks(3);
    pauseRecording();
    assertSaveReady();
    assertWaveformDurationAtLeast(5);
  });

  it('recovers the take to Save when the microphone is unplugged mid-record', () => {
    mountMediaRecord();
    waitForRecordReady();
    startRecording();
    advanceRecordingTicks(3);

    cy.window().then((win) => {
      win.__recordingMock?.unplugCapture();
    });

    cy.get('svg[data-testid="PauseIcon"]').should('not.exist');
    // Finalize is still in flight (clock frozen): Record/Save stay blocked.
    cy.get('#wsAudioWaveform')
      .closest('.MuiStack-root')
      .parent()
      .children()
      .last()
      .find('[role="button"]')
      .should('have.attr', 'aria-disabled', 'true');
    cy.get('#rec-save').should('not.exist');

    cy.tick(200);
    assertSaveReady();
    assertWaveformDurationAtLeast(2);
  });
});
