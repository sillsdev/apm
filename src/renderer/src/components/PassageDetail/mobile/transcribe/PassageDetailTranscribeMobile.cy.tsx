import React from 'react';
import { Provider } from 'react-redux';
import {
  legacy_createStore as createStore,
  combineReducers,
  applyMiddleware,
} from 'redux';
import { thunk } from 'redux-thunk';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { createAppTheme } from '../../../../theme';
import Memory from '@orbit/memory';
import Coordinator from '@orbit/coordinator';

import { GlobalProvider, GlobalState } from '../../../../context/GlobalContext';
import { IOrbitContext } from '../../../../hoc/OrbitContext';
import { OrbitContext } from '../../../../hoc/OrbitContextProvider';
import { UnsavedContext } from '../../../../context/UnsavedContext';
import { PassageDetailContext } from '../../../../context/PassageDetailContext';
import { PlayInPlayer } from '../../../../context/PlayInPlayer';
import { HotKeyContext } from '../../../../context/HotKeyContext';

import localizationReducer from '../../../../store/localization/reducers';
import bookReducer from '../../../../store/book/reducers';
import {
  ActivityStates,
  MediaFileD,
  PassageD,
  SectionD,
} from '../../../../model';
import { createMinimalWavBlob } from '../../../../../cypress/support/recordingMocks';
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

const createMockMemory = (
  recordsByType: RecordsByType,
  memoryUpdate?: any
): Memory =>
  ({
    cache: {
      query: (queryFn: (q: unknown) => unknown) =>
        queryFn(createMockQueryBuilder(recordsByType)),
      liveQuery: (queryFn: (q: unknown) => unknown) => ({
        subscribe: () => () => {},
        query: () => queryFn(createMockQueryBuilder(recordsByType)),
      }),
    },
    update: memoryUpdate ?? cy.stub().as('memoryUpdate').resolves(),
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
  }),
  undefined,
  applyMiddleware(thunk as any)
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
      onGotoNextStep?: () => void;
      onHideHeader?: (hide: boolean) => void;
      onSetSelected?: (id: string, inPlayer: any) => void;
      onSaveCompleted?: (toolId: string, err?: string) => void;
      waitForSave?: any;
      memoryUpdate?: any;
      playerMediafile?: MediaFileD | undefined;
      mediafileId?: string;
      currentstep?: string;
      mediafiles?: MediaFileD[];
      workflowSteps?: any[];
      artifactTypes?: any[];
      routePasId?: string;
    } = {}
  ) => {
    const {
      transcription = 'Existing transcription text',
      transcriptionstate = ActivityStates.Transcribing,
      onSetStepComplete = cy.stub().as('setStepComplete'),
      onGotoNextStep = cy.stub().as('gotoNextStep'),
      onHideHeader = cy.stub().as('setHideMobileHeader'),
      onSetSelected = cy.stub().as('setSelected'),
      onSaveCompleted = cy.stub().as('saveCompleted'),
      waitForSave = (_cb: any, _ms?: number) => Promise.resolve(),
      memoryUpdate,
      playerMediafile,
      mediafileId = 'media-1',
      currentstep = 'step-transcribe',
      mediafiles,
      workflowSteps,
      artifactTypes = [],
      routePasId = 'pass-1',
    } = options;

    const defaultMedia: MediaFileD = {
      id: 'media-1',
      type: 'mediafile',
      attributes: {
        versionNumber: 1,
        transcription,
        transcriptionstate,
        duration: 20,
        position: 0,
        segments: '{"regions":[{"start":0,"end":5}]}',
        dateCreated: '2026-01-01T00:00:00Z',
      },
      relationships: {
        passage: { data: { type: 'passage', id: 'pass-1' } },
        plan: { data: { type: 'plan', id: 'plan-1' } },
      },
    } as unknown as MediaFileD;

    const mediaList = mediafiles ?? [defaultMedia];
    const initialMedia = mediaList.find((m) => m.id === mediafileId) ?? defaultMedia;

    const playerMediafileToUse =
      'playerMediafile' in options ? options.playerMediafile : initialMedia;

    const mockPassage: PassageD = {
      id: 'pass-1',
      type: 'passage',
      attributes: {
        sequencenum: 1,
        reference: 'MAT 1:1',
      },
      relationships: {
        section: { data: { type: 'section', id: 'sec-1' } },
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
        passages: { data: [{ type: 'passage', id: 'pass-1' }] },
      },
    } as unknown as SectionD;

    const defaultWorkflowSteps = [
      {
        id: 'step-transcribe',
        type: 'orgworkflowstep',
        attributes: {
          sequencenum: 1,
          tool: JSON.stringify({ tool: 'transcribe', settings: '{}' }),
        },
      },
    ];
    const stepList = workflowSteps ?? defaultWorkflowSteps;

    const memory = createMockMemory(
      {
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
            attributes: { slug: 'test-plan', name: 'Test Plan', flat: false },
            relationships: {
              plantype: { data: { type: 'plantype', id: 'plantype-1' } },
            },
          },
        ],
        plantype: [
          {
            id: 'plantype-1',
            type: 'plantype',
            attributes: { name: 'Scripture' },
          },
        ],
        section: [mockSection],
        passage: [mockPassage],
        mediafile: mediaList,
        artifacttype: artifactTypes,
        orgworkflowstep: stepList,
      },
      memoryUpdate
    );

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
      waitForSave,
      saveCompleted: onSaveCompleted,
    };

    const passageDetailContextValue = {
      state: {
        passage: mockPassage,
        section: mockSection,
        mediafileId,
        currentstep,
        tool: 'transcribe',
        orgWorkflowSteps: stepList,
        rowData: [],
        stepComplete: () => false,
        setStepComplete: onSetStepComplete,
        setCurrentStep: cy.stub(),
        gotoNextStep: onGotoNextStep,
        sharedResource: null,
        playing: false,
        hideMobileHeader: false,
        setHideMobileHeader: onHideHeader,
        allBookData: [],
        playerMediafile: playerMediafileToUse,
        setSelected: onSetSelected,
        audioBlob: createMinimalWavBlob(2),
        loading: false,
        pdBusy: false,
        setPDBusy: cy.stub(),
        setupLocate: cy.stub(),
        setCurrentSegment: cy.stub(),
        setPlayerSegments: cy.stub(),
        getCurrentSegment: () => undefined,
        setPlaying: cy.stub(),
        setRecording: cy.stub(),
        setCommentRecording: cy.stub(),
        setDiscussionMarkers: cy.stub(),
        handleHighlightDiscussion: cy.stub(),
        forceRefresh: cy.stub(),
      } as any,
      setState: cy.stub(),
    };

    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider init={createInitialState(memory)}>
          <OrbitContext.Provider value={orbitContextValue}>
            <UnsavedContext.Provider
              value={{ state: unsavedState as any, setState: cy.stub() }}
            >
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
                  <ThemeProvider theme={createAppTheme('en')}>
                    <MemoryRouter initialEntries={[`/detail/proj-1/${routePasId}`]}>
                      <Routes>
                        <Route
                          path="/detail/:prjId/:pasId"
                          element={<PassageDetailTranscribeMobile width={360} />}
                        />
                      </Routes>
                    </MemoryRouter>
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
    cy.get('#transcriptionText').should('have.value', 'Existing transcription text');

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

    cy.get('#transcriptionText').focus();
    cy.get('@setHideMobileHeader').should('have.been.calledWith', true);

    cy.get('#transcriptionText').blur();
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

  it('does not complete step or navigate when submit update fails', () => {
    cy.on('uncaught:exception', () => false);
    const onSetStepComplete = cy.stub().as('setStepComplete');
    const onGotoNextStep = cy.stub().as('gotoNextStep');
    const memoryUpdate = cy.stub().as('memoryUpdate').rejects(new Error('Save failed'));
    mountTranscribeMobile({
      onSetStepComplete,
      onGotoNextStep,
      memoryUpdate,
    });

    cy.get('#transcriber\\.submit').click();
    cy.get('@setStepComplete').should('not.have.been.called');
    cy.get('@gotoNextStep').should('not.have.been.called');
  });

  it('does not complete step or navigate when waitForSave rejects in handleComplete', () => {
    cy.on('uncaught:exception', () => false);
    const onSetStepComplete = cy.stub().as('setStepComplete');
    const onGotoNextStep = cy.stub().as('gotoNextStep');
    const waitForSave = cy.stub().as('waitForSave').rejects(new Error('Save failed'));
    mountTranscribeMobile({
      onSetStepComplete,
      onGotoNextStep,
      waitForSave,
    });

    cy.get('#transcriber\\.submit').click();
    cy.get('@setStepComplete').should('not.have.been.called');
    cy.get('@gotoNextStep').should('not.have.been.called');
  });

  it('selects media into player when playerMediafile is undefined or differs from mediafileId', () => {
    const onSetSelected = cy.stub().as('setSelected');
    mountTranscribeMobile({
      playerMediafile: undefined,
      onSetSelected,
    });

    cy.get('@setSelected').should(
      'have.been.calledWith',
      'media-1',
      PlayInPlayer.yes
    );
  });

  it('forwards error to saveCompleted when save fails so unsaved state is not silently cleared', () => {
    cy.on('uncaught:exception', () => false);
    const onSaveCompleted = cy.stub().as('saveCompleted');
    const memoryUpdate = cy.stub().as('memoryUpdate').rejects(new Error('Save failed'));
    mountTranscribeMobile({
      onSaveCompleted,
      memoryUpdate,
    });

    cy.get('#transcriber\\.save').click();
    cy.get('@saveCompleted').should(
      'have.been.calledWith',
      'step-transcribe',
      'Save failed'
    );
  });

  it('notifies saveCompleted on successful save', () => {
    const onSaveCompleted = cy.stub().as('saveCompleted');
    mountTranscribeMobile({
      onSaveCompleted,
    });

    cy.get('#transcriber\\.save').click();
    cy.get('@saveCompleted').should(
      'have.been.calledWith',
      'step-transcribe'
    );
  });

  it('resolves artifact task media for artifactTypeId instead of vernacular mediafileId', () => {
    const vernMedia: MediaFileD = {
      id: 'media-vernacular',
      type: 'mediafile',
      attributes: {
        versionNumber: 1,
        transcription: 'Vernacular text',
        transcriptionstate: ActivityStates.Approved,
        duration: 10,
        position: 0,
        segments: '{}',
        dateCreated: '2026-01-01T00:00:00Z',
      },
      relationships: {
        passage: { data: { type: 'passage', id: 'pass-1' } },
        plan: { data: { type: 'plan', id: 'plan-1' } },
      },
    } as unknown as MediaFileD;

    const artifactMedia: MediaFileD = {
      id: 'media-artifact-1',
      type: 'mediafile',
      attributes: {
        versionNumber: 1,
        transcription: 'Phrase BT text',
        transcriptionstate: ActivityStates.Transcribing,
        duration: 10,
        position: 0,
        segments: '{}',
        languagebcp47: 'es',
        dateCreated: '2026-01-02T00:00:00Z',
      },
      relationships: {
        passage: { data: { type: 'passage', id: 'pass-1' } },
        plan: { data: { type: 'plan', id: 'plan-1' } },
        artifactType: { data: { type: 'artifacttype', id: 'art-type-pbt' } },
        sourceMedia: { data: { type: 'mediafile', id: 'media-vernacular' } },
      },
    } as unknown as MediaFileD;

    const artifactTypes = [
      {
        id: 'art-type-pbt',
        type: 'artifacttype',
        attributes: {
          typename: 'backtranslation',
        },
      },
    ];

    const workflowSteps = [
      {
        id: 'step-bt-transcribe',
        type: 'orgworkflowstep',
        attributes: {
          sequencenum: 1,
          tool: JSON.stringify({
            tool: 'transcribe',
            settings: JSON.stringify({ artifactTypeId: 'art-type-pbt', language: 'es' }),
          }),
        },
      },
    ];

    const onSetSelected = cy.stub().as('setSelected');
    const memoryUpdate = cy.stub().as('memoryUpdate').resolves();

    mountTranscribeMobile({
      mediafileId: 'media-vernacular',
      currentstep: 'step-bt-transcribe',
      mediafiles: [vernMedia, artifactMedia],
      artifactTypes,
      workflowSteps,
      playerMediafile: undefined,
      onSetSelected,
      memoryUpdate,
    });

    // Should load the artifact media into player, not the vernacular media
    cy.get('@setSelected').should(
      'have.been.calledWith',
      'media-artifact-1',
      PlayInPlayer.yes
    );

    // Textarea should display the artifact task transcription text
    cy.get('#transcriptionText').should('have.value', 'Phrase BT text');

    // Saving should update the artifact mediafile record
    cy.get('#transcriptionText').clear().type('Updated Phrase BT');
    cy.get('#transcriber\\.save').click();

    cy.get('@memoryUpdate').should((stub: any) => {
      const calls = stub.getCalls();
      expect(calls.length).to.be.greaterThan(0);
      const firstTransform = calls[0].args[0];
      const ops = Array.isArray(firstTransform)
        ? firstTransform
        : (firstTransform?.operations ?? []);
      const mediaOp = ops.find(
        (op: any) =>
          op.record?.type === 'mediafile' &&
          op.record?.id === 'media-artifact-1'
      );
      expect(mediaOp).to.exist;
      expect(mediaOp?.record?.attributes?.transcription).to.equal(
        'Updated Phrase BT'
      );
    });
  });

  it('filters artifact media by step language settings', () => {
    const vernMedia: MediaFileD = {
      id: 'media-vernacular',
      type: 'mediafile',
      attributes: {
        versionNumber: 1,
        transcription: 'Vernacular text',
        transcriptionstate: ActivityStates.Approved,
        duration: 10,
        position: 0,
        segments: '{}',
        dateCreated: '2026-01-01T00:00:00Z',
      },
      relationships: {
        passage: { data: { type: 'passage', id: 'pass-1' } },
        plan: { data: { type: 'plan', id: 'plan-1' } },
      },
    } as unknown as MediaFileD;

    const esMedia: MediaFileD = {
      id: 'media-artifact-es',
      type: 'mediafile',
      attributes: {
        versionNumber: 1,
        transcription: 'Spanish BT text',
        transcriptionstate: ActivityStates.Transcribing,
        duration: 10,
        position: 0,
        segments: '{}',
        languagebcp47: 'es',
        dateCreated: '2026-01-02T00:00:00Z',
      },
      relationships: {
        passage: { data: { type: 'passage', id: 'pass-1' } },
        plan: { data: { type: 'plan', id: 'plan-1' } },
        artifactType: { data: { type: 'artifacttype', id: 'art-type-pbt' } },
        sourceMedia: { data: { type: 'mediafile', id: 'media-vernacular' } },
      },
    } as unknown as MediaFileD;

    const frMedia: MediaFileD = {
      id: 'media-artifact-fr',
      type: 'mediafile',
      attributes: {
        versionNumber: 1,
        transcription: 'French BT text',
        transcriptionstate: ActivityStates.Transcribing,
        duration: 10,
        position: 0,
        segments: '{}',
        languagebcp47: 'fr',
        dateCreated: '2026-01-03T00:00:00Z',
      },
      relationships: {
        passage: { data: { type: 'passage', id: 'pass-1' } },
        plan: { data: { type: 'plan', id: 'plan-1' } },
        artifactType: { data: { type: 'artifacttype', id: 'art-type-pbt' } },
        sourceMedia: { data: { type: 'mediafile', id: 'media-vernacular' } },
      },
    } as unknown as MediaFileD;

    const artifactTypes = [
      {
        id: 'art-type-pbt',
        type: 'artifacttype',
        attributes: {
          typename: 'backtranslation',
        },
      },
    ];

    const workflowSteps = [
      {
        id: 'step-bt-transcribe-fr',
        type: 'orgworkflowstep',
        attributes: {
          sequencenum: 1,
          tool: JSON.stringify({
            tool: 'transcribe',
            settings: JSON.stringify({ artifactTypeId: 'art-type-pbt', language: 'fr' }),
          }),
        },
      },
    ];

    const onSetSelected = cy.stub().as('setSelected');

    mountTranscribeMobile({
      mediafileId: 'media-vernacular',
      currentstep: 'step-bt-transcribe-fr',
      mediafiles: [vernMedia, esMedia, frMedia],
      artifactTypes,
      workflowSteps,
      playerMediafile: undefined,
      onSetSelected,
    });

    // Should load the French artifact media into player based on step language 'fr'
    cy.get('@setSelected').should(
      'have.been.calledWith',
      'media-artifact-fr',
      PlayInPlayer.yes
    );

    // Textarea should display French text
    cy.get('#transcriptionText').should('have.value', 'French BT text');
  });
});
