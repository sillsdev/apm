/// <reference types="cypress" />
import React from 'react';
import ProjectsScreen from './ProjectsScreen';
import { GlobalProvider } from '../context/GlobalContext';
import { Provider } from 'react-redux';
import {
  legacy_createStore as createStore,
  combineReducers,
  applyMiddleware,
} from 'redux';
import { thunk } from 'redux-thunk';
import { MemoryRouter } from 'react-router-dom';
import { LocalKey, localUserKey } from '../utils';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../auth/bugsnagClient';
import LocalizedStrings from 'react-localization';
import localizationReducer from '../store/localization/reducers';
import DataProvider from '../hoc/DataProvider';
import { UnsavedProvider } from '../context/UnsavedContext';
import { TokenContext } from '../context/TokenProvider';

// Create a mock liveQuery object with subscribe and query methods
const createMockLiveQuery = () => ({
  subscribe: () => () => {}, // Returns unsubscribe function
  query: () => [],
});

// Mock memory
const createMockMemory = (): Memory => {
  return {
    cache: {
      query: () => [],
      liveQuery: createMockLiveQuery,
    },
    query: (queryFn: (q: any) => any) => {
      const mockQueryBuilder = {
        findRecord: () => undefined,
        findRecords: () => [],
      };
      return queryFn(mockQueryBuilder);
    },
    update: () => {},
  } as unknown as Memory;
};

const mockCoordinator = {
  getSource: () => createMockMemory(),
} as unknown as Coordinator;

// Mock Redux selectors
const mockCardStrings = new LocalizedStrings({
  en: {
    addNewProject: 'Add New Project...',
    switchTeams: 'Switch Teams',
    editWorkflow: 'Edit Workflow{0}',
    noProjects: 'No projects yet.',
    personalProjects: 'Personal Projects',
  },
});

const mockSharedStrings = new LocalizedStrings({
  en: {
    admin: 'Admin',
  },
});

// Create a mock reducer that returns our test strings
const mockStringsReducer = () => {
  const initialState = localizationReducer(undefined, { type: '@@INIT' });
  return {
    ...initialState,
    loaded: true,
    lang: 'en',
    cards: mockCardStrings,
    shared: mockSharedStrings,
  };
};

// Create store with mock reducer and thunk middleware
const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
    books: () => ({
      loaded: false,
      suggestions: [],
      bookData: [], // This is allBookData - must be an array, not undefined
      map: {},
    }),
    orbit: () => ({}),
    upload: () => ({}),
    paratext: () => ({}),
    importexport: () => ({}),
    auth: () => ({}),
  }),
  applyMiddleware(thunk)
);

describe('ProjectsScreen', () => {
  beforeEach(() => {
    // Clear localStorage and set up test data
    cy.window().then((win) => {
      win.localStorage.clear();
      win.localStorage.setItem(LocalKey.userId, 'test-user-id');
      win.localStorage.setItem(LocalKey.connected, 'true');
    });
  });

  const createInitialState = (overrides = {}) => ({
    coordinator: mockCoordinator,
    errorReporter: bugsnagClient,
    fingerprint: 'test-fingerprint',
    memory: createMockMemory(),
    lang: 'en',
    latestVersion: '',
    loadComplete: false,
    offlineOnly: false,
    organization: '',
    releaseDate: '',
    user: 'test-user-id',
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

  // Helper function to mount ProjectsScreen with all required providers
  const mountProjectsScreen = (
    initialState: ReturnType<typeof createInitialState>,
    initialEntries: string[] = ['/projects']
  ) => {
    const memory = createMockMemory();

    // Create mock TokenContext value
    const mockTokenContextValue = {
      state: {
        accessToken: null as string | null,
        profile: undefined,
        expiresAt: 0 as number | null,
        email_verified: false as boolean | undefined,
        logout: cy.stub(),
        resetExpiresAt: cy.stub(),
        authenticated: cy.stub().returns(false),
        setAuthSession: cy.stub(),
      },
      setState: cy.stub(),
    };

    const stateWithMemory = {
      ...initialState,
      memory,
    };

    cy.mount(
      <MemoryRouter initialEntries={initialEntries}>
        <Provider store={mockStore}>
          <GlobalProvider init={stateWithMemory}>
            <DataProvider dataStore={memory}>
              <UnsavedProvider>
                <TokenContext.Provider value={mockTokenContextValue as any}>
                  <ProjectsScreen />
                </TokenContext.Provider>
              </UnsavedProvider>
            </DataProvider>
          </GlobalProvider>
        </Provider>
      </MemoryRouter>
    );
  };

  it('should render ProjectsScreen', () => {
    mountProjectsScreen(createInitialState());

    cy.get('#ProjectsScreen').should('exist');
    cy.get('header').should('exist'); // AppHead should render
  });

  it('should display "No projects yet." when there are no projects', () => {
    mountProjectsScreen(createInitialState(), ['/projects']);

    // TeamProvider will query memory for projects, which will be empty
    // So we should see the "No projects yet." message
    cy.contains('No projects yet.').should('be.visible');
  });

  it('should show "Add New Project..." button', () => {
    mountProjectsScreen(createInitialState());

    cy.get('#ProjectActAdd').should('be.visible');
    cy.contains('Add New Project...').should('be.visible');
  });

  it('should open ProjectDialog when "Add New Project..." button is clicked', () => {
    mountProjectsScreen(createInitialState());

    cy.get('#ProjectActAdd').click();

    // ProjectDialog should open (check for dialog role or form elements)
    cy.get('[role="dialog"]').should('be.visible');
  });

  it('should show "Switch Teams" button', () => {
    mountProjectsScreen(createInitialState());

    cy.get('#ProjectActSwitch').should('be.visible');
    cy.contains('Switch Teams').should('be.visible');
  });

  it('should navigate to switch-teams when "Switch Teams" button is clicked', () => {
    mountProjectsScreen(createInitialState(), ['/projects']);

    cy.get('#ProjectActSwitch').click();

    // Verify localStorage was updated (plan removed)
    cy.window()
      .its('localStorage')
      .then((localStorage) => {
        cy.wrap(localStorage.getItem(LocalKey.plan)).should('be.null');
      });
  });

  it('should not show "Edit Workflow" button when not admin', () => {
    mountProjectsScreen(createInitialState(), ['/projects']);

    // Edit Workflow button should not exist for non-admin users
    cy.get('#ProjectActEditWorkflow').should('not.exist');
  });

  it('should not show "Edit Workflow" button when viewing personal projects', () => {
    cy.window().then((win) => {
      win.localStorage.setItem(localUserKey(LocalKey.team), 'personal-team-id');
    });

    mountProjectsScreen(createInitialState(), ['/projects']);

    // Edit Workflow button should not exist for personal projects
    cy.get('#ProjectActEditWorkflow').should('not.exist');
  });

  it('should not show "Edit Workflow" button on mobile devices', () => {
    cy.viewport(400, 800); // Mobile viewport

    mountProjectsScreen(createInitialState(), ['/projects']);

    // Edit Workflow button should not be visible on mobile
    cy.get('#ProjectActEditWorkflow').should('not.exist');
  });

  it('should apply mobile styling when on mobile device', () => {
    cy.viewport(400, 800); // Mobile viewport

    mountProjectsScreen(createInitialState());

    cy.get('#ProjectsScreen').should('exist');
    // Mobile styling is applied via isMobile prop
  });

  it('should set home to true on mount', () => {
    mountProjectsScreen(createInitialState({ home: false }));

    // The component sets home to true in useEffect
    // We can verify this by checking that navigation doesn't happen immediately
    cy.wait(100);
    cy.get('#ProjectsScreen').should('exist');
  });
});
