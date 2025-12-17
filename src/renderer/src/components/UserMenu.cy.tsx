import React from 'react';
import { UserMenu } from './UserMenu';
import { GlobalProvider } from '../context/GlobalContext';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { MemoryRouter } from 'react-router-dom';
import { LocalKey, localUserKey } from '../utils';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../auth/bugsnagClient';
import LocalizedStrings from 'react-localization';
import localizationReducer from '../store/localization/reducers';
import DataProvider from '../hoc/DataProvider';
import { UnsavedProvider } from '../context/UnsavedContext';

// Mock dependencies
// Create a mock liveQuery object with subscribe and query methods
const createMockLiveQuery = () => ({
  subscribe: () => () => {}, // Returns unsubscribe function
  query: () => [],
});

const mockMemory = {
  cache: {
    query: () => [],
    liveQuery: createMockLiveQuery,
  },
  update: () => {},
} as unknown as Memory;

const mockCoordinator = {
  getSource: () => mockMemory,
} as unknown as Coordinator;

// Mock Redux selectors
const mockMainStrings = new LocalizedStrings({
  en: {
    myAccount: 'My Account',
    mobileView: 'Mobile View',
    logout: 'Logout',
    switchUser: 'Switch User',
    clearCache: 'Clear Cache',
    clearLogout: 'Clear Logout',
    privacy: 'Privacy',
    terms: 'Terms',
    orgRole: 'Role',
  },
});

const mockSharedStrings = new LocalizedStrings({
  en: {
    admin: 'Admin',
    consultant: 'Consultant',
    editor: 'Editor',
    transcriber: 'Transcriber',
  },
});

// Create a mock reducer that returns our test strings
const mockStringsReducer = () => {
  const initialState = localizationReducer(undefined, { type: '@@INIT' });
  return {
    ...initialState,
    loaded: true,
    lang: 'en',
    main: mockMainStrings,
    shared: mockSharedStrings,
  };
};

// Create store with mock reducer
const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
    books: () => ({}),
    orbit: () => ({}),
    upload: () => ({}),
    paratext: () => ({}),
    importexport: () => ({}),
    auth: () => ({}),
  })
);

describe('UserMenu', () => {
  let mockAction: ReturnType<typeof cy.stub>;

  beforeEach(() => {
    // Create a new stub for each test
    mockAction = cy.stub();

    // Clear localStorage and set up test user
    cy.window().then((win) => {
      win.localStorage.clear();
      win.localStorage.setItem(LocalKey.userId, 'test-user-id');
    });
  });

  const createInitialState = (overrides = {}) => ({
    coordinator: mockCoordinator,
    errorReporter: bugsnagClient,
    fingerprint: 'test-fingerprint',
    memory: mockMemory,
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

  // Helper function to mount UserMenu with all required providers
  const mountUserMenu = (
    initialState: ReturnType<typeof createInitialState>
  ) => {
    cy.mount(
      <MemoryRouter>
        <Provider store={mockStore}>
          <GlobalProvider init={initialState}>
            <DataProvider dataStore={mockMemory}>
              <UnsavedProvider>
                <UserMenu action={mockAction} />
              </UnsavedProvider>
            </DataProvider>
          </GlobalProvider>
        </Provider>
      </MemoryRouter>
    );
  };

  it('should render the user menu button', () => {
    mountUserMenu(createInitialState());
    cy.get('#userMenu').should('be.visible');
  });

  it('should open menu when button is clicked', () => {
    mountUserMenu(createInitialState());

    cy.get('#userMenu').click();
    cy.get('#custom-user-menu').should('be.visible');
    cy.contains('My Account').should('be.visible');
  });

  it('should display mobile view menu item with unchecked checkbox when mobileView is false', () => {
    const initialState = createInitialState({ mobileView: false });
    mountUserMenu(initialState);

    cy.get('#userMenu').click();
    cy.get('#mobileView').should('be.visible');
    cy.get('#mobileView').within(() => {
      cy.get('input').should('not.be.checked');
    });
    cy.contains('Mobile View').should('be.visible');
  });

  it('should display mobile view menu item with checked checkbox when mobileView is true', () => {
    // Set mobileView in localStorage to match the initial state
    cy.window().then((win) => {
      const key = localUserKey(LocalKey.mobileView);
      win.localStorage.setItem(key, 'true');
    });

    const initialState = createInitialState({
      mobileView: true,
      user: 'test-user-id',
    });
    mountUserMenu(initialState);

    // Wait for the sync effect to complete
    cy.wait(100);

    cy.get('#userMenu').click();
    cy.get('#mobileView').should('be.visible');
    cy.get('#mobileView').within(() => {
      // MUI Checkbox uses a different input structure
      cy.get('input').should('be.checked');
    });
  });

  it('should toggle mobileView when mobile view menu item is clicked', () => {
    // Ensure localStorage is set to false initially
    cy.window().then((win) => {
      const key = localUserKey(LocalKey.mobileView);
      win.localStorage.setItem(key, 'false');
    });

    const initialState = createInitialState({
      mobileView: false,
      user: 'test-user-id',
    });
    mountUserMenu(initialState);

    // Wait for the sync effect to complete
    cy.wait(100);

    cy.get('#userMenu').click();

    // Initially unchecked
    cy.get('#mobileView').within(() => {
      cy.get('input').should('not.be.checked');
    });

    // Click to toggle
    cy.get('#mobileView').click();

    // Menu should close after toggle - check for hidden state instead of not.exist
    // because keepMounted keeps it in the DOM
    // Wait a bit for the close animation
    cy.wait(100);
    cy.get('#custom-user-menu').should('not.be.visible');

    // Reopen menu to verify state changed
    cy.get('#userMenu').click();
    cy.get('#mobileView').should('be.visible');
    cy.get('#mobileView').within(() => {
      cy.get('input').should('be.checked');
    });
  });

  it('should persist mobileView to localStorage when toggled', () => {
    const initialState = createInitialState({ mobileView: false });
    mountUserMenu(initialState);

    cy.get('#userMenu').click();
    cy.get('#mobileView').click();

    // Verify localStorage was updated
    cy.window().then((win) => {
      const key = localUserKey(LocalKey.mobileView);
      expect(win.localStorage.getItem(key)).to.equal('true');
    });
  });

  it('should sync mobileView from localStorage when user is available', () => {
    // Set mobileView in localStorage before mounting
    cy.window().then((win) => {
      const key = localUserKey(LocalKey.mobileView);
      win.localStorage.setItem(key, 'true');
    });

    const initialState = createInitialState({
      mobileView: false,
      user: 'test-user-id',
    });
    mountUserMenu(initialState);

    // Wait for sync effect to run
    cy.wait(100);

    cy.get('#userMenu').click();
    cy.get('#mobileView').within(() => {
      cy.get('input[type="checkbox"]').should('be.checked');
    });
  });

  it('should not display mobile view menu item when on mobile device', () => {
    // Set viewport to mobile size (below 'sm' breakpoint which is 600px)
    cy.viewport(400, 800);

    const initialState = createInitialState({ mobileView: false });
    mountUserMenu(initialState);

    cy.get('#userMenu').click();
    // Mobile view option should not be visible on mobile devices
    cy.get('#mobileView').should('not.exist');
    // But other menu items should still be visible
    cy.contains('My Account').should('be.visible');
    cy.contains('Logout').should('be.visible');
  });

  it('should display myAccount menu item', () => {
    const initialState = createInitialState();
    mountUserMenu(initialState);

    cy.get('#userMenu').click();
    cy.get('#myAccount').should('be.visible');
    cy.contains('My Account').should('be.visible');
  });

  it('should display logout menu item', () => {
    const initialState = createInitialState();
    mountUserMenu(initialState);

    cy.get('#userMenu').click();
    cy.get('#logout').should('be.visible');
    cy.contains('Logout').should('be.visible');
  });

  it('should call action when logout is clicked', () => {
    const initialState = createInitialState();
    mountUserMenu(initialState);

    cy.get('#userMenu').click();
    cy.get('#logout').click();
    cy.wrap(mockAction).should('have.been.calledWith', 'Logout');
  });

  it('should display privacy and terms menu items', () => {
    const initialState = createInitialState();
    mountUserMenu(initialState);

    cy.get('#userMenu').click();
    cy.get('#privacy').should('be.visible');
    cy.get('#terms').should('be.visible');
    cy.contains('Privacy').should('be.visible');
    cy.contains('Terms').should('be.visible');
  });

  it('should close menu when privacy is clicked', () => {
    const initialState = createInitialState();
    mountUserMenu(initialState);

    cy.get('#userMenu').click();
    cy.get('#privacy').click();
    // Wait for menu to close
    cy.wait(100);
    cy.get('#custom-user-menu').should('not.be.visible');
    cy.wrap(mockAction).should('have.been.calledWith', 'Privacy');
  });

  it('should close menu when terms is clicked', () => {
    const initialState = createInitialState();
    mountUserMenu(initialState);

    cy.get('#userMenu').click();
    cy.get('#terms').click();
    // Wait for menu to close
    cy.wait(100);
    cy.get('#custom-user-menu').should('not.be.visible');
    cy.wrap(mockAction).should('have.been.calledWith', 'Terms');
  });
});
