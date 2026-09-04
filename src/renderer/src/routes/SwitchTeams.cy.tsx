/// <reference types="cypress" />
import React from 'react';
import { SwitchTeamsInner } from './SwitchTeams';
import AppLayout from '../components/App/AppLayout';
import { TeamContext } from '../context/TeamContext';
import { GlobalProvider } from '../context/GlobalContext';
import { Provider } from 'react-redux';
import {
  legacy_createStore as createStore,
  combineReducers,
  applyMiddleware,
} from 'redux';
import { thunk } from 'redux-thunk';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LocalKey, localUserKey } from '../utils';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import { InitializedRecord } from '@orbit/records';
import bugsnagClient from '../auth/bugsnagClient';
import { schema, keyMap } from '../schema';
import LocalizedStrings from 'react-localization';
import localizationReducer from '../store/localization/reducers';
import DataProvider from '../hoc/DataProvider';
import { UnsavedProvider } from '../context/UnsavedContext';
import { TokenContext } from '../context/TokenProvider';

const USER_ID = 'test-user-id';
const PERSONAL_TEAM = 'personal-team-id';

// Create a mock liveQuery object with subscribe and query methods
const createMockLiveQuery = () => ({
  subscribe: () => () => {}, // Returns unsubscribe function
  query: () => [],
});

/**
 * Mock memory. `schema`/`keyMap` are required by StandardRecordNormalizer (used
 * by ImportTab's useOfflineSetup).
 *
 * `cache.query` dispatches on the query builder rather than always answering
 * `[]`, so a test can seed records the screen actually reads — notably the user
 * record, whose `sharedContentAdmin` attribute is what `useRole` turns into
 * `userIsSharedContentAdmin` (the Shared Content Creator button's condition).
 */
const createMockMemory = (records: InitializedRecord[] = []): Memory => {
  const queryBuilder = {
    findRecord: (identity: { type: string; id: string }) =>
      records.find((r) => r.type === identity.type && r.id === identity.id),
    findRecords: () => [],
    findRelatedRecord: () => undefined,
    findRelatedRecords: () => [],
  };
  const runQuery = (queryFn: (q: any) => any) => {
    try {
      return queryFn(queryBuilder);
    } catch {
      return [];
    }
  };
  return {
    schema,
    keyMap,
    cache: {
      query: runQuery,
      liveQuery: createMockLiveQuery,
    },
    query: runQuery,
    update: () => {},
  } as unknown as Memory;
};

const sharedContentAdminUser = (isAdmin: boolean): InitializedRecord =>
  ({
    type: 'user',
    id: USER_ID,
    attributes: { sharedContentAdmin: isAdmin },
  }) as unknown as InitializedRecord;

const mockCoordinator = {
  getSource: () => createMockMemory(),
} as unknown as Coordinator;

// Mock Redux selectors. Every string the screen (and the dialogs it owns)
// renders is defined here, so tests can assert on real text.
const mockCardStrings = new LocalizedStrings({
  en: {
    add: 'Add',
    addNewTeam: 'Add New Team...',
    addTeam: 'Add Team',
    cancel: 'Cancel',
    creatorAdd: 'Add Shared Content Creator',
    creatorEmail: 'Email',
    creatorOK: 'Creator added successfully',
    deleteTeam: 'Delete Team',
    explainTeamDelete: 'This cannot be undone',
    import: 'Import',
    personal: 'Personal',
    personalProjects: 'Personal Audio Projects',
    personalSettings: 'Personal Settings',
    process: 'Process',
    save: 'Save',
    saving: 'Saving...',
    teamName: 'Team Name',
    teams: 'Teams',
    teamSettings: 'Team Settings',
  },
});

const mockSharedStrings = new LocalizedStrings({
  en: {
    admin: 'Admin',
    cancel: 'Cancel',
    close: 'Close',
    save: 'Save',
    saving: 'Saving...',
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

const createTeam = (id: string, name: string) =>
  ({
    id,
    type: 'organization',
    attributes: { name, defaultParams: '{}' },
  }) as any;

const createInitialState = (overrides: Record<string, unknown> = {}) => ({
  coordinator: mockCoordinator,
  errorReporter: bugsnagClient,
  fingerprint: 'test-fingerprint',
  memory: createMockMemory(),
  latestVersion: '',
  loadComplete: false,
  offlineOnly: false,
  organization: '',
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
  addStoryOrPassage: false,
  ...overrides,
});

interface MountOptions {
  /** Overrides for the global (GlobalProvider) state, e.g. offline/developer. */
  global?: Record<string, unknown>;
  /** Teams the mocked TeamProvider hands the screen. */
  teams?: any[];
  personalTeam?: string;
  /** False models the team directory still loading. */
  teamDirectoryReady?: boolean;
  /** Which teams the signed-in user administers (personal is always settable). */
  isAdmin?: (team: any) => boolean;
  isDeleting?: boolean;
  /** Seeds the user record `useRole` reads for the Shared Content Creator button. */
  sharedContentAdmin?: boolean;
}

/**
 * Mounts the same tree as the SwitchTeams route, with TeamProvider replaced by
 * a mock so teams, the personal team and admin rights are all inputs the test
 * controls rather than whatever the (empty) mock memory happens to resolve.
 *
 * `/team` and `/error` are stub routes so navigation is observable: the screen
 * navigates instead of rendering, and the stub tells us where it went.
 */
const mountSwitchTeams = (options: MountOptions = {}) => {
  const {
    global: globalOverrides = {},
    teams = [],
    personalTeam = PERSONAL_TEAM,
    teamDirectoryReady = true,
    isAdmin = () => true,
    isDeleting = false,
    sharedContentAdmin = false,
  } = options;

  const memory = createMockMemory([sharedContentAdminUser(sharedContentAdmin)]);

  const teamCreate = cy.stub().as('teamCreate');
  const teamUpdate = cy.stub().as('teamUpdate');
  const teamDelete = cy.stub().as('teamDelete').resolves();

  const mockTeamCtx = {
    state: {
      teams,
      personalTeam,
      teamDirectoryReady,
      isDeleting,
      isAdmin,
      teamCreate,
      teamUpdate,
      teamDelete,
    },
    setState: cy.stub(),
  };

  const mockTokenContextValue = {
    state: {
      accessToken: 'test-token' as string | null,
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

  cy.mount(
    <MemoryRouter initialEntries={['/switch-teams']}>
      <Provider store={mockStore}>
        <GlobalProvider
          init={{ ...createInitialState(globalOverrides), memory }}
        >
          <DataProvider dataStore={memory}>
            <UnsavedProvider>
              <TokenContext.Provider value={mockTokenContextValue as any}>
                <TeamContext.Provider value={mockTeamCtx as any}>
                  <Routes>
                    <Route
                      path="/switch-teams"
                      element={
                        <AppLayout appHeadProps={{ drawBottomBorder: false }}>
                          <SwitchTeamsInner />
                        </AppLayout>
                      }
                    />
                    <Route
                      path="/team"
                      element={<div data-testid="team-route" />}
                    />
                    <Route
                      path="/error"
                      element={<div data-testid="error-route" />}
                    />
                  </Routes>
                </TeamContext.Provider>
              </TokenContext.Provider>
            </UnsavedProvider>
          </DataProvider>
        </GlobalProvider>
      </Provider>
    </MemoryRouter>
  );
};

const expectSelectedTeam = (teamId: string | null) =>
  cy.window().then((win) => {
    expect(win.localStorage.getItem(localUserKey(LocalKey.team))).to.equal(
      teamId
    );
  });

beforeEach(() => {
  cy.window().then((win) => {
    win.localStorage.clear();
    win.localStorage.setItem(LocalKey.userId, USER_ID);
    win.localStorage.setItem(LocalKey.connected, 'true');
  });
});

describe('SwitchTeams sections and cards', { tags: '@smoke' }, () => {
  it('renders the picker inside the app chrome', () => {
    mountSwitchTeams();

    cy.get('#TeamsScreen').should('exist');
    cy.get('header').should('exist'); // AppHead should render
  });

  it('renders the personal section with the personal projects card', () => {
    mountSwitchTeams();

    cy.get('[data-testid="personal-section"]')
      .should('be.visible')
      .and('contain', 'Personal');
    cy.get('[data-testid="personal-row"]').should(
      'contain',
      'Personal Audio Projects'
    );
  });

  it('renders one team card per team, labelled with the team name', () => {
    mountSwitchTeams({
      teams: [
        createTeam('team-a', 'Alpha Team'),
        createTeam('team-b', 'Beta Team'),
      ],
    });

    cy.get('[data-testid="teams-section"]')
      .should('be.visible')
      .and('contain', 'Teams');
    cy.get('[data-testid="team-row"]').should('have.length', 2);
    cy.get('[data-testid="team-row"]').eq(0).should('contain', 'Alpha Team');
    cy.get('[data-testid="team-row"]').eq(1).should('contain', 'Beta Team');
  });

  it('renders the teams section with no cards when the user has no teams', () => {
    mountSwitchTeams({ teams: [] });

    cy.get('[data-testid="teams-section"]').should('be.visible');
    cy.get('[data-testid="team-row"]').should('not.exist');
  });

  it('selects the personal team and navigates to /team when the personal card is clicked', () => {
    mountSwitchTeams();

    cy.get('[data-testid="personal-row"]').click();

    cy.get('[data-testid="team-route"]').should('exist');
    expectSelectedTeam(PERSONAL_TEAM);
  });

  it('selects the clicked team and navigates to /team when a team card is clicked', () => {
    mountSwitchTeams({
      teams: [
        createTeam('team-a', 'Alpha Team'),
        createTeam('team-b', 'Beta Team'),
      ],
    });

    cy.get('[data-testid="team-row"]').eq(1).click();

    cy.get('[data-testid="team-route"]').should('exist');
    expectSelectedTeam('team-b');
  });
});

describe('SwitchTeams header actions', { tags: '@smoke' }, () => {
  it('shows Add Team when online and connected', () => {
    mountSwitchTeams();

    cy.get('#TeamActAdd').should('be.visible').and('contain', 'Add Team');
  });

  it('hides Add Team when offline', () => {
    mountSwitchTeams({ global: { offline: true } });

    cy.get('#TeamActAdd').should('not.exist');
  });

  it('hides Add Team when not connected', () => {
    mountSwitchTeams({ global: { connected: false } });

    cy.get('#TeamActAdd').should('not.exist');
  });

  it('hides Add Team when offlineOnly (TT-7573 Work Alone)', () => {
    mountSwitchTeams({
      teams: [createTeam('team-a', 'Alpha Team')],
      global: { offline: true, offlineOnly: true },
    });

    cy.get('#TeamActAdd').should('not.exist');
  });

  it('hides Add Team when offline even in developer mode', () => {
    mountSwitchTeams({ global: { offline: true, developer: true } });

    cy.get('#TeamActAdd').should('not.exist');
  });

  it('shows Import both online and offline', () => {
    mountSwitchTeams({ global: { offline: false } });
    cy.get('#teamActImport').should('be.visible').and('contain', 'Import');

    mountSwitchTeams({ global: { offline: true } });
    cy.get('#teamActImport').should('be.visible').and('contain', 'Import');
  });

  it('shows Shared Content Creator when online and the user is a shared content admin', () => {
    mountSwitchTeams({ global: { offline: false }, sharedContentAdmin: true });

    cy.get('#contentCreator').should('be.visible');
  });

  it('hides Shared Content Creator when the user is not a shared content admin', () => {
    mountSwitchTeams({ global: { offline: false }, sharedContentAdmin: false });

    cy.get('#contentCreator').should('not.exist');
  });

  it('hides Shared Content Creator when offline even for a shared content admin', () => {
    mountSwitchTeams({ global: { offline: true }, sharedContentAdmin: true });

    cy.get('#contentCreator').should('not.exist');
  });

  it('shows the Error button only in developer mode', () => {
    mountSwitchTeams({ global: { developer: false } });
    cy.get('#Error').should('not.exist');

    mountSwitchTeams({ global: { developer: true } });
    cy.get('#Error').should('be.visible').and('contain', 'Error');
  });

  it('navigates to /error when the Error button is clicked', () => {
    mountSwitchTeams({ global: { developer: true } });

    cy.get('#Error').click();

    cy.get('[data-testid="error-route"]').should('exist');
  });
});

describe('SwitchTeams add team dialog', { tags: '@smoke' }, () => {
  it('opens the Add Team dialog and closes it again on cancel', () => {
    mountSwitchTeams();

    cy.get('#TeamActAdd').click();
    cy.get('#teamDialog').should('be.visible');
    cy.get('#teamDlg').should('contain', 'Add Team');

    cy.get('#teamCancel').click();
    cy.get('#teamDialog').should('not.exist');
  });

  it('disables the Add button until a name is entered', () => {
    mountSwitchTeams();

    cy.get('#TeamActAdd').click();
    cy.get('#teamCommit').should('be.disabled');

    cy.get('#teamName').type('Gamma Team');
    cy.get('#teamCommit').should('be.enabled');
  });

  it('calls teamCreate with the entered name when the dialog is committed', () => {
    mountSwitchTeams();

    cy.get('#TeamActAdd').click();
    cy.get('#teamName').type('Gamma Team');
    cy.get('#teamCommit').click();

    cy.get('@teamCreate')
      .should('have.been.calledOnce')
      .its('firstCall.args.0.attributes.name')
      .should('equal', 'Gamma Team');
  });
});

describe('SwitchTeams shared content creator dialog', { tags: '@smoke' }, () => {
  const openDialog = () => {
    mountSwitchTeams({ global: { offline: false }, sharedContentAdmin: true });
    cy.get('#contentCreator').click();
    cy.get('#bigDlg').should('contain', 'Add Shared Content Creator');
  };

  it('opens the dialog with an empty email field', () => {
    openDialog();

    cy.get('#email').should('be.visible').and('have.value', '');
  });

  it('offers Save only once the email is valid', () => {
    openDialog();

    // onSave is undefined while the email is invalid, so BigDialog renders no Save
    cy.contains('button', 'Save').should('not.exist');

    cy.get('#email').type('invalid-email');
    cy.contains('button', 'Save').should('not.exist');

    cy.get('#email').clear().type('Test@Example.com');
    cy.get('#email').should('have.value', 'test@example.com'); // lowercased on change
    cy.contains('button', 'Save').should('be.visible');
  });

  it('closes and clears the email when cancelled', () => {
    openDialog();

    cy.get('#email').type('test@example.com');
    cy.get('#bigCancel').click();
    cy.get('#bigDlg').should('not.exist');

    cy.get('#contentCreator').click();
    cy.get('#email').should('have.value', '');
  });
});

describe('SwitchTeams import dialog', { tags: '@smoke' }, () => {
  it('opens the import dialog from the Import button', () => {
    // Online keeps offerPtf true so ImportTab only shows type selection; offline +
    // browser runs electron import in useEffect, gets invalid data, and closes
    // immediately.
    mountSwitchTeams({ global: { offline: false } });

    cy.get('[data-testid="import-button"]').should('be.visible').click();

    cy.get('#importDlg').should('be.visible');
  });
});

describe('SwitchTeams settings button visibility', { tags: '@smoke' }, () => {
  const teams = [createTeam('team-a', 'Alpha Team')];

  it('shows the settings button on the personal card and on an administered team', () => {
    mountSwitchTeams({ teams, isAdmin: () => true });

    cy.get('[data-testid="personal-settings"]').should('be.visible');
    cy.get('[data-testid="team-settings"]').should('be.visible');
  });

  it('hides the settings button on a team the user does not administer', () => {
    mountSwitchTeams({ teams, isAdmin: () => false });

    cy.get('[data-testid="personal-settings"]').should('be.visible');
    cy.get('[data-testid="team-settings"]').should('not.exist');
  });

  it('hides settings buttons when offline and not offlineOnly', () => {
    mountSwitchTeams({ teams, global: { offline: true } });

    cy.get('[data-testid="personal-settings"]').should('not.exist');
    cy.get('[data-testid="team-settings"]').should('not.exist');
  });

  it('shows settings buttons when offlineOnly', () => {
    mountSwitchTeams({ teams, global: { offline: true, offlineOnly: true } });

    cy.get('[data-testid="personal-settings"]').should('be.visible');
    cy.get('[data-testid="team-settings"]').should('be.visible');
  });

  it('hides settings buttons at mobile width', () => {
    cy.viewport(375, 667);
    mountSwitchTeams({ teams });

    cy.get('[data-testid="personal-settings"]').should('not.exist');
    cy.get('[data-testid="team-settings"]').should('not.exist');
  });
});

describe('SwitchTeams settings dialog', { tags: '@smoke' }, () => {
  const teams = [createTeam('team-a', 'Alpha Team')];

  it('opens personal settings without a name field or delete section', () => {
    mountSwitchTeams({ teams });

    cy.get('[data-testid="personal-settings"]').click();

    cy.get('#teamDialog').should('be.visible');
    cy.get('#teamDlg').should('contain', 'Personal Settings');
    // The personal team is not renamable and cannot be deleted
    cy.get('#teamName').should('not.exist');
    cy.get('#deleteExpand').should('not.exist');
  });

  it('opens team settings prefilled with the team name and a delete section', () => {
    mountSwitchTeams({ teams });

    cy.get('[data-testid="team-settings"]').click();

    cy.get('#teamDialog').should('be.visible');
    cy.get('#teamDlg').should('contain', 'Team Settings');
    cy.get('#teamName').should('have.value', 'Alpha Team');
    cy.get('#deleteExpand').should('exist');
  });

  it('does not select the team when the settings button is clicked', () => {
    mountSwitchTeams({ teams });

    cy.get('[data-testid="team-settings"]').click();

    cy.get('#teamDialog').should('be.visible');
    cy.get('[data-testid="team-route"]').should('not.exist');
    expectSelectedTeam(null);
  });

  it('calls teamUpdate with the renamed team and closes on commit', () => {
    mountSwitchTeams({ teams });

    cy.get('[data-testid="team-settings"]').click();
    cy.get('#teamName').clear().type('Renamed Team');
    cy.get('#teamCommit').click();

    cy.get('@teamUpdate')
      .should('have.been.calledOnce')
      .its('firstCall.args.0.attributes.name')
      .should('equal', 'Renamed Team');
    cy.get('#teamDialog').should('not.exist');
  });

  it('calls teamDelete with the team and closes when deleted', () => {
    mountSwitchTeams({ teams });

    cy.get('[data-testid="team-settings"]').click();
    cy.get('#panel1a-header').click();
    cy.get('#deleteExpand').click();

    cy.get('@teamDelete')
      .should('have.been.calledOnce')
      .its('firstCall.args.0.id')
      .should('equal', 'team-a');
    cy.get('#teamDialog').should('not.exist');
  });

  it('disables the commit button while a delete is in progress', () => {
    mountSwitchTeams({ teams, isDeleting: true });

    cy.get('[data-testid="team-settings"]').click();
    cy.get('#teamName').clear().type('Renamed Team');
    cy.get('#teamCommit').should('be.disabled');
  });
});

describe('SwitchTeams PAP-like guard', { tags: '@smoke' }, () => {
  const papLike = {
    teams: [],
    personalTeam: PERSONAL_TEAM,
    teamDirectoryReady: true,
    global: { offline: true, offlineOnly: true },
  };

  it('renders nothing until the personal team resolves', () => {
    mountSwitchTeams({ ...papLike, personalTeam: '' });

    cy.get('#TeamsScreen').should('not.exist');
    cy.get('[data-testid="team-route"]').should('not.exist');
  });

  it('redirects to /team and selects the personal team when PAP-like', () => {
    mountSwitchTeams(papLike);

    cy.get('[data-testid="team-route"]').should('exist');
    cy.get('#TeamsScreen').should('not.exist');
    expectSelectedTeam(PERSONAL_TEAM);
  });

  it('shows the picker when offline but not offlineOnly (empty teams is not reliable PAP)', () => {
    mountSwitchTeams({
      ...papLike,
      global: { offline: true, offlineOnly: false },
    });

    cy.get('#TeamsScreen').should('exist');
    cy.get('[data-testid="team-route"]').should('not.exist');
  });

  it('shows the picker when offlineOnly but the user has teams', () => {
    mountSwitchTeams({
      ...papLike,
      teams: [createTeam('team-a', 'Alpha Team')],
    });

    cy.get('#TeamsScreen').should('exist');
    cy.get('[data-testid="team-route"]').should('not.exist');
  });

  it('shows the picker while the team directory is still loading', () => {
    mountSwitchTeams({ ...papLike, teamDirectoryReady: false });

    cy.get('#TeamsScreen').should('exist');
    cy.get('[data-testid="team-route"]').should('not.exist');
  });
});
