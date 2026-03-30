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
import {
  BurritoContents,
  burritoContents as burritoContentsOrgKey,
} from './BurritoContents';
import { GlobalProvider } from '../context/GlobalContext';
import { UnsavedProvider } from '../context/UnsavedContext';
import { TokenContext } from '../context/TokenProvider';
import DataProvider from '../hoc/DataProvider';
import bugsnagClient from '../auth/bugsnagClient';
import localizationReducer from '../store/localization/reducers';
import { schema, keyMap } from '../schema';
import { LocalKey } from '../utils';
import { BurritoType } from './BurritoType';

type MockRec = {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, unknown>;
};

const TEAM_ID = 'team-one';
const USER_ID = 'test-user-id';

/** Minimal records: TeamProvider + ProfileDialog; BurritoContents has no project/plan queries. */
const createContentsDataset = (teamOrgDefaults?: string): Record<string, MockRec[]> => ({
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
        defaultParams: teamOrgDefaults ?? '{}',
        dateCreated: '',
        dateUpdated: '',
        lastModifiedBy: 0,
      },
    },
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
  bookData: [],
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

describe('BurritoContents', () => {
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

  const mountBurritoContents = (
    initialState: ReturnType<typeof createInitialState>,
    initialEntry = `/burrito/${TEAM_ID}/contents`
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
                    <Route
                      path="/burrito/:teamId/contents"
                      element={<BurritoContents />}
                    />
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
      win.localStorage.setItem(LocalKey.userId, USER_ID);
      win.localStorage.setItem(LocalKey.connected, 'true');
    });
  });

  it('renders Scripture Burrito contents header and burrito type options', () => {
    const memory = createBurritoMockMemory(createContentsDataset());
    mountBurritoContents(createInitialState(memory));

    cy.get('#BurritoScreen').should('exist');
    cy.contains('h1', 'Scripture Burrito - Contents').should('be.visible');
    cy.get(`#checkbox-list-label-${BurritoType.Audio}`).should('be.visible');
    cy.get(`#checkbox-list-label-${BurritoType.Text}`).should('be.visible');
  });

  it('disables Save until at least one content type is selected', () => {
    const memory = createBurritoMockMemory(createContentsDataset());
    mountBurritoContents(createInitialState(memory));

    cy.contains('button', 'Save').should('be.disabled');
    cy.get(`#checkbox-list-label-${BurritoType.Audio}`).click();
    cy.contains('button', 'Save').should('not.be.disabled');
  });

  it('restores selections from organization defaultParams', () => {
    const defaults = JSON.stringify({
      [burritoContentsOrgKey]: [BurritoType.Audio, BurritoType.Text],
    });
    const memory = createBurritoMockMemory(
      createContentsDataset(defaults)
    );
    mountBurritoContents(createInitialState(memory));

    cy.get(`input[aria-labelledby="checkbox-list-label-${BurritoType.Audio}"]`).should(
      'be.checked'
    );
    cy.get(`input[aria-labelledby="checkbox-list-label-${BurritoType.Text}"]`).should(
      'be.checked'
    );
    cy.contains('button', 'Save').should('not.be.disabled');
  });

  it('navigates away via StickyRedirect after Save', () => {
    const memory = createBurritoMockMemory(createContentsDataset());
    mountBurritoContents(createInitialState(memory));

    cy.get(`#checkbox-list-label-${BurritoType.Resources}`).click();
    cy.contains('button', 'Save').click();

    cy.get('#BurritoScreen', { timeout: 5000 }).should('not.exist');
  });
});
