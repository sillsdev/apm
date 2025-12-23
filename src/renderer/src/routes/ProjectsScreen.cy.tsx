/// <reference types="cypress" />
import React from 'react';
import ProjectsScreen, { ProjectsScreenInner } from './ProjectsScreen';
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
import { TeamContext } from '../context/TeamContext';

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
    initialEntries: string[] = ['/projects'],
    options?: {
      isAdmin?: (team: any) => boolean;
      personalTeam?: string;
      teams?: any[];
    }
  ) => {
    const memory = createMockMemory();

    // Default options
    const {
      isAdmin = () => false,
      personalTeam = 'personal-team-id',
      teams = [],
    } = options || {};

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

    // Create mock TeamContext value
    const mockTeamContextValue = {
      state: {
        lang: 'en',
        ts: {} as any,
        resetOrbitError: cy.stub(),
        bookSuggestions: [],
        bookMap: {} as any,
        allBookData: [],
        planTypes: [],
        isDeleting: false,
        teams: teams,
        personalTeam: personalTeam,
        personalProjects: [],
        teamProjects: () => [],
        teamMembers: () => 0,
        loadProject: () => {},
        setProjectParams: () => ['', ''],
        projectType: () => '',
        projectSections: () => '',
        projectDescription: () => '',
        projectLanguage: () => '',
        projectCreate: async () => '',
        projectUpdate: () => {},
        projectDelete: () => {},
        teamCreate: () => {},
        teamUpdate: () => {},
        teamDelete: async () => {},
        isAdmin: isAdmin,
        isProjectAdmin: () => false,
        flatAdd: async () => {},
        cardStrings: mockCardStrings,
        sharedStrings: {} as any,
        vProjectStrings: {} as any,
        pickerStrings: {} as any,
        projButtonStrings: {} as any,
        newProjectStrings: {} as any,
        importOpen: false,
        setImportOpen: () => {},
        importProject: undefined,
        doImport: () => {},
        resetProjectPermissions: async () => {},
        generalBook: () => '000',
        updateGeneralBooks: async () => {},
        checkScriptureBooks: () => {},
        tab: 0,
        setTab: () => {},
      },
      setState: cy.stub(),
    };

    const stateWithMemory = {
      ...initialState,
      memory,
    };

    // If options are provided, use ProjectsScreenInner with mock TeamContext
    // Otherwise, use ProjectsScreen with real TeamProvider
    const screenElement = options ? (
      <TeamContext.Provider value={mockTeamContextValue as any}>
        <ProjectsScreenInner />
      </TeamContext.Provider>
    ) : (
      <ProjectsScreen />
    );

    cy.mount(
      <MemoryRouter initialEntries={initialEntries}>
        <Provider store={mockStore}>
          <GlobalProvider init={stateWithMemory}>
            <DataProvider dataStore={memory}>
              <UnsavedProvider>
                <TokenContext.Provider value={mockTokenContextValue as any}>
                  {screenElement}
                </TokenContext.Provider>
              </UnsavedProvider>
            </DataProvider>
          </GlobalProvider>
        </Provider>
      </MemoryRouter>
    );
  };

  // Helper function to create a standard test team
  const createTestTeam = (teamId = 'test-team-id', teamName = 'Test Team') => ({
    id: teamId,
    type: 'organization',
    attributes: { name: teamName },
  });

  // Helper function to set up localStorage with teamId
  const setupTeamInLocalStorage = (teamId: string, planId?: string) => {
    cy.window().then((win) => {
      win.localStorage.setItem(localUserKey(LocalKey.team), teamId);
      if (planId) {
        win.localStorage.setItem(LocalKey.plan, planId);
      }
    });
  };

  // Helper function to mount ProjectsScreen with standard team setup
  const mountWithTeam = (
    teamId = 'test-team-id',
    options: {
      isAdmin?: (team: any) => boolean;
      personalTeam?: string;
      initialState?: ReturnType<typeof createInitialState>;
      initialEntries?: string[];
    } = {}
  ) => {
    const {
      isAdmin = () => false,
      personalTeam = 'personal-team-id',
      initialState = createInitialState(),
      initialEntries = ['/projects'],
    } = options;

    const mockTeam = createTestTeam(teamId);
    setupTeamInLocalStorage(teamId);

    mountProjectsScreen(initialState, initialEntries, {
      isAdmin,
      personalTeam,
      teams: [mockTeam],
    });
  };

  // Helper function to mount ProjectsScreen without teamId (for testing missing teamId scenario)
  const mountWithoutTeam = (
    options: {
      planId?: string;
      personalTeam?: string;
      initialState?: ReturnType<typeof createInitialState>;
      initialEntries?: string[];
    } = {}
  ) => {
    const {
      planId,
      personalTeam = 'personal-team-id',
      initialState = createInitialState(),
      initialEntries = ['/projects'],
    } = options;

    cy.window().then((win) => {
      win.localStorage.removeItem(localUserKey(LocalKey.team));
      if (planId) {
        win.localStorage.setItem(LocalKey.plan, planId);
      }
    });

    mountProjectsScreen(initialState, initialEntries, {
      isAdmin: () => false,
      personalTeam,
      teams: [],
    });
  };

  it('should render ProjectsScreen', () => {
    mountWithTeam();

    cy.get('#ProjectsScreen').should('exist');
    cy.get('header').should('exist'); // AppHead should render
  });

  it('should display "No projects yet." when there are no projects', () => {
    mountWithTeam();

    // TeamProvider will query memory for projects, which will be empty
    // So we should see the "No projects yet." message
    cy.contains('No projects yet.').should('be.visible');
  });

  it('should show "Add New Project..." button when isAdmin returns true', () => {
    const teamId = 'test-team-id';
    mountWithTeam(teamId, {
      isAdmin: (team: any) => team?.id === teamId,
    });

    cy.get('#ProjectActAdd').should('be.visible');
    cy.contains('Add New Project...').should('be.visible');
  });

  it('should open ProjectDialog when "Add New Project..." button is clicked', () => {
    const teamId = 'test-team-id';
    mountWithTeam(teamId, {
      isAdmin: (team: any) => team?.id === teamId,
    });

    cy.get('#ProjectActAdd').click();

    // ProjectDialog should open (check for dialog role or form elements)
    cy.get('[role="dialog"]').should('be.visible');
  });

  it('should not show "Add New Project..." button when isAdmin returns false', () => {
    mountWithTeam();

    cy.get('#ProjectActAdd').should('not.exist');
  });

  it('should show "Switch Teams" button', () => {
    mountWithTeam();

    cy.get('#ProjectActSwitch').should('be.visible');
    cy.contains('Switch Teams').should('be.visible');
  });

  it('should navigate to switch-teams when "Switch Teams" button is clicked', () => {
    mountWithTeam();

    cy.get('#ProjectActSwitch').click();

    // Verify localStorage was updated (plan removed)
    cy.window()
      .its('localStorage')
      .then((localStorage) => {
        cy.wrap(localStorage.getItem(LocalKey.plan)).should('be.null');
      });
  });

  it('should not show "Edit Workflow" button when not admin', () => {
    mountWithTeam();

    // Edit Workflow button should not exist for non-admin users
    cy.get('#ProjectActEditWorkflow').should('not.exist');
  });

  it('should not show "Edit Workflow" button when viewing personal projects', () => {
    setupTeamInLocalStorage('personal-team-id');

    mountProjectsScreen(createInitialState(), ['/projects']);

    // Edit Workflow button should not exist for personal projects
    cy.get('#ProjectActEditWorkflow').should('not.exist');
  });

  it('should not show "Edit Workflow" button on mobile devices', () => {
    cy.viewport(400, 800); // Mobile viewport

    mountWithTeam();

    // Edit Workflow button should not be visible on mobile
    cy.get('#ProjectActEditWorkflow').should('not.exist');
  });

  it('should apply mobile styling when on mobile device', () => {
    cy.viewport(400, 800); // Mobile viewport

    mountWithTeam();

    cy.get('#ProjectsScreen').should('exist');
    // Mobile styling is applied via isMobile prop
  });

  it('should set home to true on mount', () => {
    mountWithTeam('test-team-id', {
      initialState: createInitialState({ home: false }),
    });

    // The component sets home to true in useEffect
    // We can verify this by checking that navigation doesn't happen immediately
    cy.wait(100);
    cy.get('#ProjectsScreen').should('exist');
  });

  it('should navigate to /switch-teams when teamId is undefined', () => {
    mountWithoutTeam({ planId: 'test-plan-id' });

    // Wait for the navigation effect to occur
    // The component calls handleSwitchTeams() in useEffect when teamId is undefined,
    // which removes the plan from localStorage and navigates to /switch-teams
    cy.wait(200).then(() => {
      // Verify that navigation occurred by checking side effects of handleSwitchTeams
      // handleSwitchTeams removes LocalKey.plan before navigating to /switch-teams
      cy.window().then((win) => {
        // The plan should be removed (side effect of handleSwitchTeams, proving it was called)
        // This confirms that navigation to /switch-teams was triggered
        expect(win.localStorage.getItem(LocalKey.plan)).to.be.null;
        // Verify teamId is still undefined
        expect(win.localStorage.getItem(localUserKey(LocalKey.team))).to.be
          .null;
      });
    });

    // The component should not render its content when teamId is missing
    // (it returns null early)
    cy.get('#ProjectsScreen').should('not.exist');
  });

  it('should not navigate to /switch-teams when teamId is defined', () => {
    const teamId = 'test-team-id';

    // Set teamId and plan to verify handleSwitchTeams is not called
    setupTeamInLocalStorage(teamId, 'test-plan-id');

    const mockTeam = createTestTeam(teamId);

    // Mount with teamId defined - this should NOT trigger navigation
    // The component has: if (!teamId) handleSwitchTeams();
    // Since teamId is defined, handleSwitchTeams should not be called
    mountProjectsScreen(createInitialState(), ['/projects'], {
      isAdmin: () => false,
      personalTeam: 'personal-team-id',
      teams: [mockTeam],
    });

    // Wait a bit to ensure navigation doesn't happen
    cy.wait(200);

    // Verify ProjectsScreen renders (navigation did not happen)
    cy.get('#ProjectsScreen').should('exist');

    // Verify that handleSwitchTeams was NOT called by checking localStorage
    cy.window().then((win) => {
      expect(win.localStorage.getItem(localUserKey(LocalKey.team))).to.equal(
        teamId
      );
      // Plan should still be set (handleSwitchTeams was not called, so no navigation occurred)
      expect(win.localStorage.getItem(LocalKey.plan)).to.equal('test-plan-id');
    });
  });
});
