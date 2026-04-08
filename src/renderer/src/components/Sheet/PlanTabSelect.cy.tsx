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

/**
 * Strings aligned with the `planTabs` slice (see planTabsSelector). Matches
 * localization-takeaways: component tests drive UI text from the same keys the
 * app uses, via LocalizedStrings on the Redux `strings` slice.
 */
const planTabsFixture = {
  sectionsPassages: '{0} & Passages',
  media: 'Media',
  assignments: 'Assignments',
  transcriptions: 'Transcriptions',
} as const;

const organizedByDefault = 'Sections';
const sectionsPassagesLabel = planTabsFixture.sectionsPassages.replace(
  '{0}',
  organizedByDefault
);

// Mock memory — must match DataProvider so useOrbitData sees organizations (cypress-testing-takeaways: data-driven providers, not import stubs).
const createMockMemory = (organizations: any[] = []) =>
  ({
    cache: {
      query: () => [],
      liveQuery: (queryBuildFn: (q: any) => any) => {
        const q = {
          findRecords: (type: string) => {
            if (type === 'organization') return organizations;
            return [];
          },
        };
        const records = queryBuildFn(q);
        return {
          subscribe: () => () => {},
          query: () => records,
        };
      },
    },
    update: () => {},
  }) as unknown as Memory;

let currentTestMemory: Memory = createMockMemory();

const mockCoordinator = {
  getSource: () => currentTestMemory,
} as unknown as Coordinator;

const mockPlanTabsStrings = new LocalizedStrings({
  en: planTabsFixture,
});

const mockVProjectStrings = new LocalizedStrings({
  en: {
    sections: organizedByDefault,
    sets: 'Sets',
    stories: 'Stories',
    scenes: 'Scenes',
    pericopes: 'Pericopes',
    movements: 'Movements',
  },
});

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

/** Personal-team org shape matches isPersonalTeam (`>…Personal<` in name). */
const personalTeamOrgs = [
  {
    id: 'org-1',
    type: 'organization',
    attributes: { name: '>Test User Personal<' },
  },
];

describe('PlanTabSelect', () => {
  let mockSetTab: ReturnType<typeof cy.stub>;

  beforeEach(() => {
    mockSetTab = cy.stub().as('setTab');
  });

  const createInitialState = (overrides = {}) => ({
    coordinator: mockCoordinator,
    errorReporter: bugsnagClient,
    fingerprint: 'test-fingerprint',
    memory: currentTestMemory,
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

  const mountPlanTabSelect = (
    planContextOverrides = {},
    globalStateOverrides = {},
    organizations: any[] = []
  ) => {
    currentTestMemory = createMockMemory(organizations);
    const initialState = createInitialState(globalStateOverrides);
    const planContextState = createMockPlanContextState(planContextOverrides);

    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider init={initialState}>
          <DataProvider dataStore={currentTestMemory}>
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

  const openPlanTabMenu = () => {
    cy.get('#planTabSelect', { timeout: 5000 }).click();
    cy.get('#import-export-menu', { timeout: 5000 }).should('be.visible');
  };

  describe('layout and labels', () => {
    it('should render button with correct id and aria-label', () => {
      mountPlanTabSelect();

      cy.wait(100);
      cy.get('#planTabSelect')
        .should('exist')
        .should('be.visible')
        .should('have.attr', 'aria-label', planTabsFixture.sectionsPassages);
    });

    it('should display default item text when flat is false', () => {
      mountPlanTabSelect({ flat: false });

      cy.wait(100);
      cy.get('#planTabSelect').should('contain.text', sectionsPassagesLabel);
    });

    it('should display organizedBy text when flat is true', () => {
      mountPlanTabSelect({ flat: true });

      cy.wait(100);
      cy.get('#planTabSelect').should('contain.text', organizedByDefault);
      cy.get('#planTabSelect').should(
        'not.contain.text',
        sectionsPassagesLabel
      );
    });

    it('should display dropdown icon', () => {
      mountPlanTabSelect();

      cy.wait(100);
      cy.get('svg[data-testid="ArrowDropDownIcon"]', { timeout: 5000 }).should(
        'exist'
      );
    });

    it('should display currently selected tab text in button', () => {
      mountPlanTabSelect({ flat: false, tab: 1 });

      cy.wait(100);
      cy.get('#planTabSelect').should('contain.text', planTabsFixture.media);
    });

    it('should update button text when tab changes', () => {
      mountPlanTabSelect({ flat: false, tab: 0 });

      cy.wait(100);
      cy.get('#planTabSelect')
        .should('contain.text', sectionsPassagesLabel)
        .should('contain.text', organizedByDefault);

      mountPlanTabSelect({ flat: false, tab: 2 });
      cy.wait(100);
      cy.get('#planTabSelect').should(
        'contain.text',
        planTabsFixture.assignments
      );
    });
  });

  describe('menu interaction', () => {
    it('should open menu when button is clicked', () => {
      mountPlanTabSelect();

      cy.wait(100);
      openPlanTabMenu();
    });

    it('should close menu after selecting an item', () => {
      mountPlanTabSelect();

      cy.wait(100);
      openPlanTabMenu();
      cy.get(`#${CSS.escape(planTabsFixture.media)}`).click();
      cy.wrap(mockSetTab).should('have.been.called');
      cy.get('#planTabSelect').should('not.have.attr', 'aria-owns');
    });

    it('should set aria-owns attribute when menu is open', () => {
      mountPlanTabSelect();

      cy.wait(100);
      cy.get('#planTabSelect').should('not.have.attr', 'aria-owns');
      cy.get('#planTabSelect').click();
      cy.get('#import-export-menu', { timeout: 5000 }).should('exist');
    });

    it('should handle closing menu when clicking outside', () => {
      mountPlanTabSelect();

      cy.wait(100);
      openPlanTabMenu();
      cy.get('body').click(0, 0);
      cy.get('#import-export-menu').should('not.exist');
    });
  });

  describe('with assignments tab (non-personal team, online)', () => {
    it('should display all menu options including assignments', () => {
      mountPlanTabSelect({ flat: false });

      cy.wait(100);
      openPlanTabMenu();
      cy.get('#import-export-menu').within(() => {
        cy.contains(sectionsPassagesLabel).should('be.visible');
        cy.get(`#${CSS.escape(planTabsFixture.media)}`).should('be.visible');
        cy.get(`#${CSS.escape(planTabsFixture.assignments)}`).should(
          'be.visible'
        );
        cy.get(`#${CSS.escape(planTabsFixture.transcriptions)}`).should(
          'be.visible'
        );
      });
    });

    it('should call setTab when Media menu item is clicked', () => {
      mountPlanTabSelect({ flat: false, tab: 0 });

      cy.wait(100);
      openPlanTabMenu();
      cy.get(`#${CSS.escape(planTabsFixture.media)}`).click();
      cy.wrap(mockSetTab).should('have.been.calledWith', 1);
    });

    it('should call setTab with correct index for assignments and transcriptions', () => {
      mountPlanTabSelect({ flat: false, tab: 0 });

      cy.wait(100);
      openPlanTabMenu();

      cy.get(`#${CSS.escape(planTabsFixture.assignments)}`).click();
      cy.wrap(mockSetTab).should('have.been.calledWith', 2);

      cy.wait(300);
      cy.get('#planTabSelect').click({ force: true });
      cy.get(`#${CSS.escape(planTabsFixture.transcriptions)}`).click();
      cy.wrap(mockSetTab).should('have.been.calledWith', 3);
    });

    it('should render menu items with stable ids from localized labels', () => {
      mountPlanTabSelect({ flat: false });

      cy.wait(100);
      openPlanTabMenu();
      cy.get('#import-export-menu').within(() => {
        cy.get(`#${CSS.escape(planTabsFixture.media)}`).should('exist');
        cy.get(`#${CSS.escape(planTabsFixture.assignments)}`).should('exist');
        cy.get(`#${CSS.escape(planTabsFixture.transcriptions)}`).should(
          'exist'
        );
      });
    });

    it('should handle menu options with flat mode correctly', () => {
      mountPlanTabSelect({ flat: true });

      cy.wait(100);
      openPlanTabMenu();
      cy.get('#import-export-menu')
        .find('li[role="menuitem"]')
        .first()
        .should('contain.text', organizedByDefault)
        .should('not.contain.text', sectionsPassagesLabel);
    });
  });

  describe('without assignments tab (personal team or offline-only)', () => {
    it('should not show Assignments for personal team (Personal Audio projects)', () => {
      mountPlanTabSelect(
        { flat: false },
        { organization: 'org-1' },
        personalTeamOrgs
      );

      cy.wait(100);
      openPlanTabMenu();
      cy.get('#import-export-menu').within(() => {
        cy.get(`#${CSS.escape(planTabsFixture.assignments)}`).should(
          'not.exist'
        );
        cy.get(`#${CSS.escape(planTabsFixture.transcriptions)}`).should(
          'be.visible'
        );
      });
    });

    it('should not show Assignments when offlineOnly', () => {
      mountPlanTabSelect({ flat: false }, { offlineOnly: true });

      cy.wait(100);
      openPlanTabMenu();
      cy.get('#import-export-menu').within(() => {
        cy.get(`#${CSS.escape(planTabsFixture.assignments)}`).should(
          'not.exist'
        );
      });
    });

    it('should call setTab(2) when Transcriptions is chosen on personal team', () => {
      mountPlanTabSelect(
        { flat: false, tab: 0 },
        { organization: 'org-1' },
        personalTeamOrgs
      );

      cy.wait(100);
      openPlanTabMenu();
      cy.get(`#${CSS.escape(planTabsFixture.transcriptions)}`).click();
      cy.wrap(mockSetTab).should('have.been.calledWith', 2);
    });

    it('should show Transcriptions on button when tab is 2 on personal team', () => {
      mountPlanTabSelect(
        { flat: false, tab: 2 },
        { organization: 'org-1' },
        personalTeamOrgs
      );

      cy.wait(100);
      cy.get('#planTabSelect').should(
        'contain.text',
        planTabsFixture.transcriptions
      );
    });
  });
});
