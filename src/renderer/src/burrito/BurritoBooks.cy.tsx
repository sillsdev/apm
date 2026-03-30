/// <reference types="cypress" />
import React from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import {
  applyMiddleware,
  combineReducers,
  legacy_createStore as createStore,
} from 'redux';
import { thunk } from 'redux-thunk';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import { BurritoBooks } from './BurritoBooks';
import { GlobalProvider } from '../context/GlobalContext';
import { UnsavedProvider } from '../context/UnsavedContext';
import { TokenContext } from '../context/TokenProvider';
import DataProvider from '../hoc/DataProvider';
import bugsnagClient from '../auth/bugsnagClient';
import localizationReducer from '../store/localization/reducers';
import { schema, keyMap } from '../schema';
import { LocalKey } from '../utils';

type MockRec = {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, unknown>;
};

const TEAM_ID = 'team-one';
const PROJ_ID = 'proj-1';
const PLAN_ID = 'plan-1';
const SECTION_ID = 'sec-1';
const PASSAGE_ID = 'pas-1';
const USER_ID = 'test-user-id';

const createTeamDataset = (): Record<string, MockRec[]> => ({
  user: [
    {
      id: USER_ID,
      type: 'user',
      attributes: {
        name: 'Tester',
        email: 'tester@example.com',
        givenName: 'Test',
        familyName: 'User',
        phone: '',
        timezone: 'UTC',
        locale: 'en',
        dateCreated: '',
        dateUpdated: '',
        lastModifiedBy: 0,
      },
    },
  ],
  organization: [
    {
      id: TEAM_ID,
      type: 'organization',
      attributes: {
        name: 'Test Team',
        defaultParams: '{}',
        dateCreated: '',
        dateUpdated: '',
        lastModifiedBy: 0,
      },
    },
    // TeamProvider calls getTeamId(undefined) → useNewTeamId needs a personal org
    {
      id: 'personal-org-id',
      type: 'organization',
      attributes: {
        name: '>Tester Personal<',
        defaultParams: '{}',
        dateCreated: '',
        dateUpdated: '',
        lastModifiedBy: 0,
      },
      relationships: {
        owner: { data: { type: 'user', id: USER_ID } },
      },
    },
  ],
  project: [
    {
      id: PROJ_ID,
      type: 'project',
      attributes: {
        name: 'Project Alpha',
        dateCreated: '',
        dateUpdated: '',
        lastModifiedBy: 0,
      },
      relationships: {
        organization: { data: { type: 'organization', id: TEAM_ID } },
      },
    },
  ],
  plan: [
    {
      id: PLAN_ID,
      type: 'plan',
      attributes: {
        dateCreated: '',
        dateUpdated: '',
        lastModifiedBy: 0,
      },
      relationships: {
        project: { data: { type: 'project', id: PROJ_ID } },
      },
    },
  ],
  section: [
    {
      id: SECTION_ID,
      type: 'section',
      attributes: {
        dateCreated: '',
        dateUpdated: '',
        lastModifiedBy: 0,
      },
      relationships: {
        plan: { data: { type: 'plan', id: PLAN_ID } },
      },
    },
  ],
  passage: [
    {
      id: PASSAGE_ID,
      type: 'passage',
      attributes: {
        book: 'GEN',
        dateCreated: '',
        dateUpdated: '',
        lastModifiedBy: 0,
      },
      relationships: {
        section: { data: { type: 'section', id: SECTION_ID } },
      },
    },
  ],
});

function createBurritoMockMemory(dataset: Record<string, MockRec[]>) {
  const getRecords = (model: string) => dataset[model] ?? [];

  const buildQueryBuilder = () => ({
    findRecord: ({ type, id }: { type: string; id: string }) =>
      getRecords(type).find((r) => r.id === id),
    findRecords: (type: string) => getRecords(type),
  });

  return {
    schema,
    keyMap,
    cache: {
      query: (fn: (q: unknown) => unknown) => fn(buildQueryBuilder()),
      liveQuery: (fn: (q: unknown) => unknown) => {
        let model = '';
        const mockQ = {
          findRecords: (m: string) => {
            model = m;
            return {};
          },
        };
        fn(mockQ);
        return {
          // Real Orbit defers notifications; a sync callback here re-triggers
          // useOrbitData on every render (subscribe runs during render) → infinite loop.
          subscribe: () => () => {},
          query: () => getRecords(model),
        };
      },
    },
    query: (fn: (q: unknown) => unknown) =>
      Promise.resolve(fn(buildQueryBuilder())),
    update: () => Promise.resolve(),
  } as unknown as Memory;
}

const createCoordinator = (memory: Memory): Coordinator =>
  ({
    getSource: (name?: string) => {
      if (name === 'remote') {
        return { requestQueue: [] };
      }
      if (name === 'memory') {
        return memory;
      }
      return memory;
    },
  }) as unknown as Coordinator;

const mockStringsReducer = () => {
  const initial = localizationReducer(undefined, { type: '@@INIT' });
  return { ...initial, loaded: true, lang: 'en' };
};

const mockBooksReducer = () => ({
  loaded: true,
  suggestions: [],
  bookData: [
    { code: 'GEN', short: 'Genesis' },
    { code: 'EXO', short: 'Exodus' },
  ],
  map: {},
});

const mockOrbitReducer = () => ({
  status: undefined as number | undefined,
  message: '',
  saving: false,
  retry: 0,
  fetchResults: undefined,
});

const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
    books: mockBooksReducer,
    orbit: mockOrbitReducer,
    upload: () => ({}),
    paratext: () => ({}),
    importexport: () => ({}),
    auth: () => ({}),
  }),
  applyMiddleware(thunk as never)
);

describe('BurritoBooks', () => {
  const createInitialState = (
    memory: Memory,
    overrides: Record<string, unknown> = {}
  ) => ({
    coordinator: createCoordinator(memory),
    errorReporter: bugsnagClient,
    fingerprint: 'test-fingerprint',
    memory,
    lang: 'en',
    latestVersion: '',
    loadComplete: false,
    offlineOnly: false,
    organization: TEAM_ID,
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
    plan: '',
    playingMediaId: '',
    progress: 0,
    project: '',
    projectsLoaded: [PROJ_ID],
    projType: '',
    remoteBusy: false,
    saveResult: undefined,
    snackAlert: undefined,
    snackMessage: (<></>) as React.JSX.Element,
    offline: false,
    mobileView: false,
    ...overrides,
  });

  const noop = () => {};
  const mockTokenContextValue = {
    state: {
      accessToken: 'test-token' as string | null,
      profile: undefined,
      expiresAt: 0 as number | null,
      email_verified: false as boolean | undefined,
      logout: noop,
      resetExpiresAt: noop,
      authenticated: () => false,
      setAuthSession: noop,
    },
    setState: noop,
  };

  const mountBurritoBooks = (
    initialState: ReturnType<typeof createInitialState>,
    initialEntry = `/burrito/${TEAM_ID}/books`
  ) => {
    const memory = initialState.memory as Memory;
    cy.mount(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Provider store={mockStore}>
          <GlobalProvider init={initialState}>
            <DataProvider dataStore={memory}>
              <UnsavedProvider>
                <TokenContext.Provider value={mockTokenContextValue as never}>
                  <Routes>
                    <Route path="/burrito/:teamId/books" element={<BurritoBooks />} />
                  </Routes>
                </TokenContext.Provider>
              </UnsavedProvider>
            </DataProvider>
          </GlobalProvider>
        </Provider>
      </MemoryRouter>
    );
  };

  beforeEach(() => {
    cy.viewport(1024, 768);
    cy.window().then((win) => {
      win.localStorage.clear();
      win.localStorage.setItem(LocalKey.userId, 'test-user-id');
      win.localStorage.setItem(LocalKey.connected, 'true');
    });
  });

  it('renders Scripture Burrito books header and sections', () => {
    const memory = createBurritoMockMemory(createTeamDataset());
    mountBurritoBooks(createInitialState(memory));

    cy.get('#BurritoScreen').should('exist');
    cy.contains('h1', 'Scripture Burrito - Books').should('be.visible');
    cy.contains('h5', 'Projects').should('be.visible');
    cy.contains('h5', 'Selected Books').should('be.visible');
  });

  it('lists team projects and updates selected books when a project is checked', () => {
    const memory = createBurritoMockMemory(createTeamDataset());
    mountBurritoBooks(createInitialState(memory));

    cy.get(`#checkbox-list-label-${PROJ_ID}`)
      .should('contain.text', 'Project Alpha')
      .click();

    cy.contains('.MuiListItem-root', 'Genesis').should('be.visible');
  });

  it('disables Save until at least one project is selected', () => {
    const memory = createBurritoMockMemory(createTeamDataset());
    mountBurritoBooks(createInitialState(memory));

    cy.contains('button', 'Save').should('be.disabled');
    cy.get(`#checkbox-list-label-${PROJ_ID}`).click();
    cy.contains('button', 'Save').should('not.be.disabled');
  });

  it('navigates away via StickyRedirect after Save when projects are already loaded', () => {
    const memory = createBurritoMockMemory(createTeamDataset());
    mountBurritoBooks(createInitialState(memory));

    cy.get(`#checkbox-list-label-${PROJ_ID}`).click();
    cy.contains('button', 'Save').click();

    cy.get('#BurritoScreen', { timeout: 5000 }).should('not.exist');
  });
});
