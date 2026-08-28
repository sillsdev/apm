import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Memory from '@orbit/memory';
import Coordinator from '@orbit/coordinator';

import { GlobalProvider, GlobalState } from '../../../../context/GlobalContext';
import { IOrbitContext } from '../../../../hoc/OrbitContext';
import { OrbitContext } from '../../../../hoc/OrbitContextProvider';
import { UnsavedContext } from '../../../../context/UnsavedContext';
import { PassageDetailContext } from '../../../../context/PassageDetailContext';
import { HotKeyContext } from '../../../../context/HotKeyContext';

import localizationReducer from '../../../../store/localization/reducers';
import bookReducer from '../../../../store/book/reducers';
import {
  ActivityStates,
  MediaFileD,
  PassageD,
  SectionD,
} from '../../../../model';
import PassageDetailTranscribeMobile from './PassageDetailTranscribeMobile';

type RecordsByType = Record<string, unknown[]>;

const createMockQueryBuilder = (recordsByType: RecordsByType) => ({
  findRecords: (type: string) => {
    const base = [...(recordsByType[type] ?? [])] as any[];
    const origFilter = base.filter.bind(base);
    base.filter = (arg: any) => {
      if (typeof arg === 'function') return origFilter(arg);
      if (arg && typeof arg === 'object' && 'attribute' in arg) {
        const { attribute, value } = arg as { attribute: string; value: any };
        return origFilter((rec: any) => rec?.attributes?.[attribute] === value);
      }
      return origFilter(() => true);
    };
    return base;
  },
  findRecord: (identity: { type: string; id: string }) =>
    (recordsByType[identity.type] ?? []).find(
      (rec) => (rec as { id: string }).id === identity.id
    ),
});

const createMockMemory = (recordsByType: RecordsByType): Memory =>
  ({
    cache: {
      query: (queryFn: (q: unknown) => unknown) =>
        queryFn(createMockQueryBuilder(recordsByType)),
      liveQuery: (queryFn: (q: unknown) => unknown) => ({
        subscribe: () => () => {},
        query: () => queryFn(createMockQueryBuilder(recordsByType)),
      }),
    },
    update: cy.stub().as('memoryUpdate').resolves(),
    schema: {
      models: {},
      generateId: () => 'id-mock',
    },
    keyMap: {
      idToKey: (_table: string, _attr: string, localId: string) => localId,
      keyToId: (_table: string, _attr: string, remoteId: string) => remoteId,
    },
  }) as unknown as Memory;

const mockStringsReducer = () => {
  const initialState = localizationReducer(undefined, { type: '@@INIT' });
  return {
    ...initialState,
    loaded: true,
    lang: 'en',
  };
};

const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
    books: bookReducer,
  })
);

const createInitialState = (
  memory: Memory,
  overrides: Partial<GlobalState> = {}
): GlobalState => ({
  coordinator: {
    getSource: (name: string) => {
      if (name === 'memory') return memory;
      return {} as unknown;
    },
  } as unknown as Coordinator,
  errorReporter: {} as any,
  fingerprint: 'test-fingerprint',
  memory,
  latestVersion: '',
  loadComplete: true,
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
  project: 'proj-1',
  projectsLoaded: [],
  projType: '',
  remoteBusy: false,
  saveResult: undefined,
  snackAlert: undefined,
  snackMessage: (<></>) as React.JSX.Element,
  offline: false,
  mobileView: true,
  addStoryOrPassage: false,
  ...overrides,
});

describe('PassageDetailTranscribeMobile', () => {
  const mountTranscribeMobile = (
    options: {
      transcription?: string;
      transcriptionstate?: string;
      hasPermission?: boolean;
      onSetStepComplete?: (complete: boolean) => void;
      onHideHeader?: (hide: boolean) => void;
    } = {}
  ) => {
    const {
      transcription = 'Existing transcription text',
      transcriptionstate = ActivityStates.Transcribing,
      onSetStepComplete = cy.stub().as('setStepComplete'),
      onHideHeader = cy.stub().as('setHideMobileHeader'),
    } = options;

    const mockMedia: MediaFileD = {
      id: 'media-1',
      type: 'mediafile',
      attributes: {
        versionNumber: 1,
        transcription,
        transcriptionstate,
        duration: 20,
        position: 0,
        segments: '{"regions":[{"start":0,"end":5}]}',
      },
    } as unknown as MediaFileD;

    const mockPassage: PassageD = {
      id: 'pass-1',
      type: 'passage',
      attributes: {
        sequencenum: 1,
        reference: 'MAT 1:1',
      },
    } as unknown as PassageD;

    const mockSection: SectionD = {
      id: 'sec-1',
      type: 'section',
      attributes: {
        sequencenum: 1,
        name: 'Section 001',
      },
      relationships: {
        plan: { data: { type: 'plan', id: 'plan-1' } },
      },
    } as unknown as SectionD;

    const memory = createMockMemory({
      organization: [
        {
          id: 'org-1',
          type: 'organization',
          attributes: {
            name: 'Test Team',
            defaultParams: '{}',
          },
        },
      ],
      project: [
        {
          id: 'proj-1',
          type: 'project',
          attributes: {
            name: 'Test Project',
            defaultFont: 'Charis SIL',
            defaultFontSize: '14pt',
            rtl: false,
          },
        },
      ],
      plan: [
        {
          id: 'plan-1',
          type: 'plan',
          attributes: { slug: 'test-plan', flat: false },
        },
      ],
      section: [mockSection],
      passage: [mockPassage],
      mediafile: [mockMedia],
      orgworkflowstep: [
        {
          id: 'step-transcribe',
          type: 'orgworkflowstep',
          attributes: {
            sequencenum: 1,
            tool: JSON.stringify({ tool: 'transcribe', settings: '{}' }),
          },
        },
      ],
    });

    const orbitCache = new Map<string, unknown[]>();
    const orbitContextValue: IOrbitContext = {
      memory,
      getRecs: (type: string) => orbitCache.get(type) as any,
      setRecs: (type: string, recs: any[] | undefined) => {
        if (recs === undefined) orbitCache.delete(type);
        else orbitCache.set(type, recs);
      },
    };

    const unsavedState = {
      startSave: cy.stub(),
      toolChanged: cy.stub(),
      toolsChanged: {},
      isChanged: () => false,
      saveRequested: () => false,
      clearRequested: () => false,
      clearCompleted: cy.stub(),
      waitForSave: (_cb: any, _ms?: number) => Promise.resolve(),
      saveCompleted: cy.stub(),
    };

    const passageDetailContextValue = {
      state: {
        passage: mockPassage,
        section: mockSection,
        mediafileId: 'media-1',
        currentstep: 'step-transcribe',
        tool: 'transcribe',
        orgWorkflowSteps: [
          {
            id: 'step-transcribe',
            type: 'orgworkflowstep',
            attributes: {
              sequencenum: 1,
              tool: JSON.stringify({ tool: 'transcribe', settings: '{}' }),
            },
          },
        ],
        rowData: [],
        stepComplete: () => false,
        setStepComplete: onSetStepComplete,
        setCurrentStep: cy.stub(),
        gotoNextStep: cy.stub(),
        sharedResource: null,
        playing: false,
        hideMobileHeader: false,
        setHideMobileHeader: onHideHeader,
        allBookData: [],
        playerMediafile: mockMedia,
        audioBlob: new Blob(['mock audio'], { type: 'audio/wav' }),
        loading: false,
        pdBusy: false,
        setPDBusy: cy.stub(),
      } as any,
      setState: cy.stub(),
    };

    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider init={createInitialState(memory)}>
          <OrbitContext.Provider value={orbitContextValue}>
            <UnsavedContext.Provider value={unsavedState as any}>
              <PassageDetailContext.Provider
                value={passageDetailContextValue as any}
              >
                <HotKeyContext.Provider
                  value={{
                    state: {
                      subscribe: () => {},
                      unsubscribe: () => {},
                      localizeHotKey: (key: string) => key,
                    },
                    setState: () => {},
                  }}
                >
                  <ThemeProvider theme={createTheme()}>
                    <PassageDetailTranscribeMobile width={360} />
                  </ThemeProvider>
                </HotKeyContext.Provider>
              </PassageDetailContext.Provider>
            </UnsavedContext.Provider>
          </OrbitContext.Provider>
        </GlobalProvider>
      </Provider>
    );
  };

  it('renders top player toolbar, speed, ASR button, textarea and action buttons', () => {
    mountTranscribeMobile();

    // Check Auto Transcription button
    cy.get('#asrButton').should('be.visible');

    // Check textarea with initial text
    cy.get('textarea').should('have.value', 'Existing transcription text');

    // Check state badge
    cy.get('[data-cy="transcribe-state-badge"]').should('be.visible');

    // Check action buttons
    cy.get('#transcriber\\.reject').should('be.visible');
    cy.get('#transcriber\\.save').should('be.visible');
    cy.get('#transcriber\\.submit').should('be.visible');
  });

  it('triggers hideMobileHeader on textarea focus and restores on blur', () => {
    const onHideHeader = cy.stub().as('setHideMobileHeader');
    mountTranscribeMobile({ onHideHeader });

    cy.get('textarea').focus();
    cy.get('@setHideMobileHeader').should('have.been.calledWith', true);

    cy.get('textarea').blur();
    cy.get('@setHideMobileHeader').should('have.been.calledWith', false);
  });

  it('submits transcription and triggers step complete', () => {
    const onSetStepComplete = cy.stub().as('setStepComplete');
    mountTranscribeMobile({ onSetStepComplete });

    cy.get('#transcriber\\.submit').click();
    cy.get('@setStepComplete').should(
      'have.been.calledWith',
      'step-transcribe',
      true
    );
  });
});
