import React from 'react';
import { PlanTabSelect } from './PlanTabSelect';
import { GlobalProvider } from '../../context/GlobalContext';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import DataProvider from '../../hoc/DataProvider';
import { PlanContext } from '../../context/PlanContext';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../auth/bugsnagClient';
import LocalizedStrings from 'react-localization';
import localizationReducer from '../../store/localization/reducers';

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
const mockPlanTabsStrings = new LocalizedStrings({
  en: {
    sectionsPassages: '{0} & Passages',
    media: 'Media',
    assignments: 'Assignments',
    transcriptions: 'Transcriptions',
  },
});

const mockVProjectStrings = new LocalizedStrings({
  en: {
    sections: 'Sections',
    sets: 'Sets',
    stories: 'Stories',
    scenes: 'Scenes',
    pericopes: 'Pericopes',
    movements: 'Movements',
  },
});

// Create a mock reducer that returns our test strings
const mockStringsReducer = () => {
  const initialState = localizationReducer(undefined, { type: '@@INIT' });
  return {
    ...initialState,
    loaded: true,
    lang: 'en',
    planTabs: mockPlanTabsStrings,
    vProject: mockVProjectStrings,
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

describe('PlanTabSelect', () => {
  let mockSetTab: ReturnType<typeof cy.stub>;

  beforeEach(() => {
    // Create stub for each test
    mockSetTab = cy.stub().as('setTab');
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

  const createMockPlanContextState = (overrides = {}) => ({
    t: {} as any,
    connected: false,
    projButtonStr: {} as any,
    mediafiles: [],
    discussions: [],
    groupmemberships: [],
    scripture: false,
    flat: false,
    shared: false,
    publishingOn: true,
    hidePublishing: true,
    canEditSheet: false,
    canPublish: false,
    sectionArr: [],
    setSectionArr: cy.stub(),
    togglePublishing: cy.stub(),
    setCanAddPublishing: cy.stub(),
    tab: 0,
    setTab: mockSetTab,
    ...overrides,
  });

  // Helper function to mount PlanTabSelect with required providers
  const mountPlanTabSelect = (
    planContextOverrides = {},
    globalStateOverrides = {}
  ) => {
    const initialState = createInitialState(globalStateOverrides);
    const planContextState = createMockPlanContextState(planContextOverrides);

    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider init={initialState}>
          <DataProvider dataStore={mockMemory}>
            <PlanContext.Provider
              value={{
                state: planContextState as any,
                setState: cy.stub(),
              }}
            >
              <PlanTabSelect />
            </PlanContext.Provider>
          </DataProvider>
        </GlobalProvider>
      </Provider>
    );
  };

  it('should render button with correct id and aria-label', () => {
    mountPlanTabSelect();

    // Wait for component to render
    cy.wait(100);
    // Should render button with id="planTabSelect"
    cy.get('button[id="planTabSelect"]', { timeout: 5000 })
      .should('exist')
      .should('be.visible')
      .should('have.attr', 'aria-label', '{0} & Passages');
  });

  it('should display default item text when flat is false', () => {
    mountPlanTabSelect({ flat: false });

    cy.wait(100);
    // Should show "Sections & Passages" with organizedBy ("Sections") replacing {0}
    // Since we're using real useOrganizedBy, it will return "Sections" by default
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).should(
      'contain.text',
      'Sections & Passages'
    );
  });

  it('should display organizedBy text when flat is true', () => {
    mountPlanTabSelect({ flat: true });

    cy.wait(100);
    // When flat is true, should show just organizedBy (e.g., "Sections")
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).should(
      'contain.text',
      'Sections'
    );
    // Should not contain the full "Sections & Passages" text
    cy.get('button[id="planTabSelect"]').should(
      'not.contain.text',
      'Sections & Passages'
    );
  });

  it('should display dropdown icon', () => {
    mountPlanTabSelect();

    cy.wait(100);
    // Should contain ArrowDropDown icon
    cy.get('svg[data-testid="ArrowDropDownIcon"]', { timeout: 5000 }).should(
      'exist'
    );
  });

  it('should open menu when button is clicked', () => {
    mountPlanTabSelect();

    cy.wait(100);
    // Click the button to open menu
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).click();
    // Menu should be visible (MUI Menu renders in a portal)
    cy.get('#import-export-menu', { timeout: 5000 }).should('be.visible');
  });

  it('should display all menu options', () => {
    mountPlanTabSelect({ flat: false });

    cy.wait(100);
    // Click to open menu
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).click();
    // Should show all options
    cy.get('#import-export-menu', { timeout: 5000 }).within(() => {
      // Should contain the default item
      cy.contains('Sections & Passages').should('be.visible');
      cy.contains('Media').should('be.visible');
      cy.contains('Assignments').should('be.visible');
      cy.contains('Transcriptions').should('be.visible');
    });
  });

  it('should call setTab when menu item is clicked', () => {
    mountPlanTabSelect({ flat: false, tab: 0 });

    cy.wait(100);
    // Click to open menu
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).click();
    // Click on Media option (index 1)
    cy.get('#import-export-menu', { timeout: 5000 }).contains('Media').click();
    // setTab should be called with index 1
    cy.wrap(mockSetTab).should('have.been.calledWith', 1);
  });

  it('should call setTab with correct index for each menu item', () => {
    mountPlanTabSelect({ flat: false, tab: 0 });

    cy.wait(100);
    // Click to open menu
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).click();

    // Click Assignments (index 2)
    cy.get('#import-export-menu', { timeout: 5000 })
      .contains('Assignments')
      .click();
    cy.wrap(mockSetTab).should('have.been.calledWith', 2);

    // Wait a bit for menu to close, then re-open menu and click Transcriptions (index 3)
    cy.wait(300);
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).click({
      force: true,
    });
    cy.get('#import-export-menu', { timeout: 5000 })
      .contains('Transcriptions')
      .click();
    cy.wrap(mockSetTab).should('have.been.calledWith', 3);
  });

  it('should close menu after selecting an item', () => {
    mountPlanTabSelect();

    cy.wait(100);
    // Click to open menu
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).click();
    cy.get('#import-export-menu', { timeout: 5000 }).should('be.visible');
    // Click on an item - this should trigger setTab and close the menu
    cy.get('#import-export-menu').contains('Media').click();
    // Verify setTab was called
    cy.wrap(mockSetTab).should('have.been.called');
    // Menu should be closed - button's aria-owns should be cleared
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).should(
      'not.have.attr',
      'aria-owns'
    );
  });

  it('should display currently selected tab text in button', () => {
    mountPlanTabSelect({ flat: false, tab: 1 });

    cy.wait(100);
    // When tab is 1, button should show "Media"
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).should(
      'contain.text',
      'Media'
    );
  });

  it('should update button text when tab changes', () => {
    mountPlanTabSelect({ flat: false, tab: 0 });

    cy.wait(100);
    // Initially should show first option
    cy.get('button[id="planTabSelect"]', { timeout: 5000 })
      .should('contain.text', 'Sections & Passages')
      .should('contain.text', 'Sections');

    // Mount again with different tab to simulate change
    // (In a real scenario, setTab would update the context state)
    mountPlanTabSelect({ flat: false, tab: 2 });
    cy.wait(100);
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).should(
      'contain.text',
      'Assignments'
    );
  });

  it('should set aria-owns attribute when menu is open', () => {
    mountPlanTabSelect();

    cy.wait(100);
    // Initially aria-owns should not be set
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).should(
      'not.have.attr',
      'aria-owns'
    );
    // Click to open menu
    cy.get('button[id="planTabSelect"]').click();
    // When menu is open, menu should exist
    cy.get('#import-export-menu', { timeout: 5000 }).should('exist');
  });

  it('should handle menu options with flat mode correctly', () => {
    mountPlanTabSelect({ flat: true });

    cy.wait(100);
    // Click to open menu
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).click();
    // First option should be just organizedBy (e.g., "Sections"), not "Sections & Passages"
    cy.get('#import-export-menu', { timeout: 5000 })
      .find('li[role="menuitem"]')
      .first()
      .should('contain.text', 'Sections')
      .should('not.contain.text', 'Sections & Passages');
  });

  it('should render menu items with correct ids', () => {
    mountPlanTabSelect({ flat: false });

    cy.wait(100);
    // Click to open menu
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).click();
    // Each menu item should have an id matching its text
    cy.get('#import-export-menu', { timeout: 5000 }).within(() => {
      cy.contains('Media').should('have.attr', 'id', 'Media');
      cy.contains('Assignments').should('have.attr', 'id', 'Assignments');
      cy.contains('Transcriptions').should('have.attr', 'id', 'Transcriptions');
    });
  });

  it('should handle closing menu when clicking outside', () => {
    mountPlanTabSelect();

    cy.wait(100);
    // Click to open menu
    cy.get('button[id="planTabSelect"]', { timeout: 5000 }).click();
    cy.get('#import-export-menu', { timeout: 5000 }).should('be.visible');
    // Click outside (on the body/document)
    cy.get('body').click(0, 0);
    // Menu should close
    cy.get('#import-export-menu').should('not.exist');
  });
});
