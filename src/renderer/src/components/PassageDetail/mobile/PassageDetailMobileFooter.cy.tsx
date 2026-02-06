import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import LocalizedStrings from 'react-localization';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../../auth/bugsnagClient';
import { GlobalProvider, GlobalState } from '../../../context/GlobalContext';
import { OrbitContext } from '../../../hoc/OrbitContextProvider';
import {
  PassageDetailContext,
  ICtxState as PassageDetailState,
} from '../../../context/PassageDetailContext';
import {
  UnsavedContext,
  ICtxState as UnsavedState,
} from '../../../context/UnsavedContext';
import { PassageD, RoleNames, SectionD } from '../../../model';
import { LocalKey, localUserKey } from '../../../utils/localUserKey';
import PassageDetailMobileFooter from './PassageDetailMobileFooter';

type RecordsByType = Record<string, any[]>;

const createMockQueryBuilder = (recordsByType: RecordsByType) => ({
  findRecords: (type: string) => recordsByType[type] ?? [],
  findRecord: (identity: { type: string; id: string }) =>
    (recordsByType[identity.type] ?? []).find((rec) => rec.id === identity.id),
});

const createMockMemory = (recordsByType: RecordsByType): Memory =>
  ({
    cache: {
      query: (queryFn: (q: any) => any) =>
        queryFn(createMockQueryBuilder(recordsByType)),
      liveQuery: (queryFn: (q: any) => any) => ({
        subscribe: () => () => {},
        query: () => queryFn(createMockQueryBuilder(recordsByType)),
      }),
    },
    update: () => {},
  }) as unknown as Memory;

const mockCoordinator = {
  getSource: () => createMockMemory({}),
} as unknown as Coordinator;

const mockMobileStrings = new LocalizedStrings({
  en: { previous: 'Previous', next: 'Next' },
});

const mockStepCompleteStrings = new LocalizedStrings({
  en: {
    title: 'Complete',
    incomplete: 'Incomplete',
    setNext: 'Set next',
  },
});

const mockStringsReducer = () => ({
  loaded: true,
  lang: 'en',
  mobile: mockMobileStrings,
  passageDetailStepComplete: mockStepCompleteStrings,
});

const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
  })
);

const createInitialState = (
  overrides: Partial<GlobalState> = {}
): GlobalState => ({
  coordinator: mockCoordinator,
  errorReporter: bugsnagClient,
  fingerprint: 'test-fingerprint',
  memory: createMockMemory({}),
  lang: 'en',
  latestVersion: '',
  loadComplete: false,
  offlineOnly: false,
  organization: 'test-org',
  releaseDate: '',
  user: 'test-user',
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
  plan: '',
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
  mobileView: false,
  ...overrides,
});

const createPassage = (
  id: string,
  sequencenum: number,
  remoteId?: string
): PassageD =>
  ({
    id,
    type: 'passage',
    attributes: {
      sequencenum,
      reference: `${sequencenum}:${sequencenum}`,
    },
    keys: remoteId ? { remoteId } : undefined,
  }) as PassageD;

const createPassageDetailState = (
  overrides: Partial<PassageDetailState> = {}
): PassageDetailState =>
  ({
    currentstep: 'step-1',
    psgCompleted: [],
    section: {
      id: 'section-1',
      type: 'section',
      relationships: {},
    } as SectionD,
    passage: {
      id: 'passage-1',
      type: 'passage',
    } as PassageD,
    recording: false,
    stepComplete: () => false,
    setStepComplete: cy.stub().resolves(),
    gotoNextStep: cy.stub(),
    setCurrentStep: cy.stub(),
    ...overrides,
  }) as PassageDetailState;

const LocationDisplay = () => {
  const location = useLocation();
  return <div data-cy="location">{location.pathname}</div>;
};

const mountFooter = ({
  passages,
  currentPassageId,
  prjId = 'project-1',
  sectionPassages,
}: {
  passages: PassageD[];
  currentPassageId: string;
  prjId?: string;
  sectionPassages?: { type: string; id: string }[];
}) => {
  const currentPassage = passages.find((p) => p.id === currentPassageId);
  const setCurrentStep = cy.stub().as('setCurrentStep');
  const recordsByType: RecordsByType = {
    passage: passages,
    organization: [
      {
        id: 'org-1',
        type: 'organization',
        attributes: {
          defaultParams: JSON.stringify({ permissions: true }),
        },
      },
    ],
    organizationschemestep: [],
    orgworkflowstep: [
      {
        id: 'step-1',
        type: 'orgworkflowstep',
        attributes: { tool: '{}' },
        relationships: {
          organization: { data: { type: 'organization', id: 'org-1' } },
        },
      },
    ],
    group: [],
    groupmembership: [],
    user: [{ id: 'user-1', type: 'user', attributes: { name: 'User One' } }],
    role: [],
    organizationmembership: [],
  };
  const memory = createMockMemory(recordsByType);
  const orbitCache = new Map<string, any[]>();
  const orbitContextValue = {
    memory,
    getRecs: (type: string) => orbitCache.get(type),
    setRecs: (type: string, recs: any[] | undefined) => {
      if (recs === undefined) orbitCache.delete(type);
      else orbitCache.set(type, recs);
    },
  };
  const section: SectionD = {
    id: 'section-1',
    type: 'section',
    relationships: {
      passages: {
        data:
          sectionPassages ??
          passages.map((p) => ({ type: 'passage', id: p.id })),
      },
    },
  } as SectionD;
  const ctxState = createPassageDetailState({
    section,
    passage: currentPassage as PassageD,
    setCurrentStep,
  });
  const initialState = createInitialState({
    memory,
    organization: 'org-1',
    user: 'user-1',
    orgRole: RoleNames.Admin,
  });
  const unsavedState = {
    checkSavedFn: (cb: () => void) => cb(),
  } as UnsavedState;

  cy.mount(
    <Provider store={mockStore}>
      <GlobalProvider init={initialState}>
        <OrbitContext.Provider value={orbitContextValue}>
          <UnsavedContext.Provider
            value={{ state: unsavedState, setState: cy.stub() }}
          >
            <PassageDetailContext.Provider
              value={{ state: ctxState, setState: cy.stub() }}
            >
              <MemoryRouter
                initialEntries={[
                  `/detail/${prjId}/${currentPassage?.keys?.remoteId ?? currentPassageId}`,
                ]}
              >
                <LocationDisplay />
                <Routes>
                  <Route
                    path="/detail/:prjId/:pasId"
                    element={<PassageDetailMobileFooter />}
                  />
                </Routes>
              </MemoryRouter>
            </PassageDetailContext.Provider>
          </UnsavedContext.Provider>
        </OrbitContext.Provider>
      </GlobalProvider>
    </Provider>
  );
};

describe('PassageDetailMobileFooter', () => {
  it('renders localized labels and step completion control', () => {
    const passages = [
      createPassage('passage-1', 1, 'remote-1'),
      createPassage('passage-2', 2, 'remote-2'),
      createPassage('passage-3', 3, 'remote-3'),
    ];

    mountFooter({ passages, currentPassageId: 'passage-2' });

    cy.contains('Previous').should('be.visible');
    cy.contains('Next').should('be.visible');
    cy.get('#mobile-complete').should('exist');
  });

  it('disables navigation buttons when no neighbors exist', () => {
    const passages = [createPassage('passage-1', 1, 'remote-1')];

    mountFooter({
      passages,
      currentPassageId: 'passage-1',
      sectionPassages: [],
    });

    cy.contains('Previous').closest('button').should('be.disabled');
    cy.contains('Next').closest('button').should('be.disabled');
  });

  it('navigates to the next passage and stores the passage id', () => {
    const passages = [
      createPassage('passage-1', 1, 'remote-1'),
      createPassage('passage-2', 2, 'remote-2'),
      createPassage('passage-3', 3, 'remote-3'),
    ];

    mountFooter({ passages, currentPassageId: 'passage-2' });

    cy.window().then((win) => {
      win.localStorage.setItem(LocalKey.userId, 'user-1');
    });

    cy.clock();
    cy.contains('Next').click();
    cy.tick(1000);

    cy.get('[data-cy="location"]').should(
      'have.text',
      '/detail/project-1/remote-3'
    );
    cy.get('@setCurrentStep').should('have.been.calledWith', '');
    cy.window().then((win) => {
      expect(win.localStorage.getItem(localUserKey(LocalKey.passage))).to.equal(
        'remote-3'
      );
    });
  });
});
