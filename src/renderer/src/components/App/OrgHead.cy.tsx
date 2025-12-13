import React from 'react';
import { OrgHead } from './OrgHead';
import { GlobalProvider } from '../../context/GlobalContext';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { MemoryRouter } from 'react-router-dom';
import { LocalKey, localUserKey } from '../../utils';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../auth/bugsnagClient';
import LocalizedStrings from 'react-localization';
import localizationReducer from '../../store/localization/reducers';
import DataProvider from '../../hoc/DataProvider';
import { UnsavedProvider } from '../../context/UnsavedContext';
import { TeamContext } from '../../context/TeamContext';
import { TokenContext } from '../../context/TokenProvider';
import { OrganizationD } from '@model/organization';

// Mock memory with query function that can return organization data
// The findRecord function uses: memory.cache.query((q) => q.findRecord({ type, id }))
// The findRecords function uses: memory.cache.query((q) => q.findRecords(type))
const createMockMemory = (
  orgData?: OrganizationD,
  isAdmin: boolean = false,
  userId: string = 'test-user-id'
): Memory => {
  // Store organizations in an array for findRecords queries
  const organizations = orgData ? [orgData] : [];

  // Create role records
  const adminRoleId = 'admin-role-id';
  const memberRoleId = 'member-role-id';
  const roles = [
    {
      id: adminRoleId,
      type: 'role',
      attributes: {
        roleName: 'Admin',
        orgRole: true,
      },
      keys: { remoteId: 'admin-role-remote-id' },
    },
    {
      id: memberRoleId,
      type: 'role',
      attributes: {
        roleName: 'Member',
        orgRole: true,
      },
      keys: { remoteId: 'member-role-remote-id' },
    },
  ];

  // Create organization membership record if orgData exists
  const orgMemberships = orgData
    ? [
        {
          id: 'org-membership-id',
          type: 'organizationmembership',
          relationships: {
            user: { data: { type: 'user', id: userId } },
            organization: { data: { type: 'organization', id: orgData.id } },
            role: {
              data: {
                type: 'role',
                id: isAdmin ? adminRoleId : memberRoleId,
              },
            },
          },
          keys: { remoteId: 'org-membership-remote-id' },
        },
      ]
    : [];

  // Create a mock query builder with both findRecord and findRecords
  const createMockQueryBuilder = () => ({
    findRecord: ({ type, id }: { type: string; id: string }) => {
      // Return the organization data if it matches
      if (type === 'organization' && id === orgData?.id && orgData) {
        return orgData;
      }
      // Return role records
      if (type === 'role') {
        const role = roles.find((r) => r.id === id);
        if (role) return role;
      }
      // Return undefined for other record types (user, etc.)
      return undefined;
    },
    findRecords: (type: string) => {
      // Return organizations array when querying for 'organization' type
      // This is used by useOrbitData('organization')
      if (type === 'organization') {
        return organizations;
      }
      // Return roles array when querying for 'role' type
      if (type === 'role') {
        return roles;
      }
      // Return organization memberships when querying for 'organizationmembership' type
      if (type === 'organizationmembership') {
        return orgMemberships;
      }
      // Return empty array for other types
      return [];
    },
  });

  return {
    cache: {
      query: (queryFn: (q: any) => any) => {
        // Execute the query function with our mock builder
        return queryFn(createMockQueryBuilder());
      },
      liveQuery: (queryFn: (q: any) => any) => {
        // liveQuery captures the query function and returns an object with subscribe and query methods
        // When query() is called, it executes the captured query function
        return {
          subscribe: () => () => {}, // Returns unsubscribe function
          query: () => {
            // Execute the query function that was passed to liveQuery
            return queryFn(createMockQueryBuilder());
          },
        };
      },
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
    members: 'Members of {0}',
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
    cards: mockCardStrings,
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
    convertBlob: () => ({}),
  })
);

describe('OrgHead', () => {
  let mockTeamDelete: ReturnType<typeof cy.stub>;

  beforeEach(() => {
    // Create stubs for each test
    mockTeamDelete = cy.stub().as('teamDelete');

    // Clear localStorage and set up test data
    cy.window().then((win) => {
      win.localStorage.clear();
      win.localStorage.setItem(LocalKey.userId, 'test-user-id');
    });
  });

  const createMockOrganization = (id: string, name: string): OrganizationD =>
    ({
      id,
      type: 'organization',
      attributes: {
        name,
      },
      relationships: {},
    }) as OrganizationD;

  const createInitialState = (overrides = {}, orgData?: OrganizationD) => ({
    coordinator: mockCoordinator,
    errorReporter: bugsnagClient,
    fingerprint: 'test-fingerprint',
    memory: createMockMemory(orgData),
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

  // Helper function to mount OrgHead with all required providers
  const mountOrgHead = (
    initialState: ReturnType<typeof createInitialState>,
    initialEntries: string[] = ['/team'],
    orgId?: string,
    orgData?: OrganizationD,
    isAdmin: boolean = false
  ) => {
    // Set organization ID in localStorage if provided
    if (orgId) {
      cy.window().then((win) => {
        win.localStorage.setItem(localUserKey(LocalKey.team), orgId);
      });
    }

    // Create memory with org data and admin status if provided
    const memory = orgData
      ? createMockMemory(orgData, isAdmin, initialState.user)
      : createMockMemory(undefined, false, initialState.user);

    // Create stubs for TeamContext methods
    const mockTeamUpdate = cy.stub().as('teamUpdate');
    const mockResetProjectPermissionsStub = cy.stub();
    mockResetProjectPermissionsStub.returns(Promise.resolve());
    const mockResetProjectPermissions = mockResetProjectPermissionsStub.as(
      'resetProjectPermissions'
    );

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

    // Create mock TeamContext value with all needed properties
    // Must match ICtxState interface from TeamContext
    const mockTeamContextValue = {
      state: {
        teamDelete: mockTeamDelete,
        teamUpdate: mockTeamUpdate,
        resetProjectPermissions: mockResetProjectPermissions,
        cardStrings: { members: 'Members of {0}' },
        // Add other required properties to match ICtxState interface
        lang: 'en',
        ts: {} as any,
        resetOrbitError: cy.stub(),
        bookSuggestions: [],
        bookMap: {} as any,
        allBookData: [],
        planTypes: [],
        isDeleting: false,
        teams: [],
        personalTeam: '',
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
        isAdmin: () => false,
        isProjectAdmin: () => false,
        flatAdd: async () => {},
        sharedStrings: {} as any,
        vProjectStrings: {} as any,
        pickerStrings: {} as any,
        projButtonStrings: {} as any,
        newProjectStrings: {} as any,
        importOpen: false,
        setImportOpen: () => {},
        importProject: undefined,
        doImport: () => {},
        generalBook: () => '000',
        updateGeneralBooks: async () => {},
        checkScriptureBooks: () => {},
        tab: 0,
        setTab: () => {},
      },
      setState: cy.stub(),
    };

    // Create state with memory
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
                  <TeamContext.Provider value={mockTeamContextValue as any}>
                    <OrgHead />
                  </TeamContext.Provider>
                </TokenContext.Provider>
              </UnsavedProvider>
            </DataProvider>
          </GlobalProvider>
        </Provider>
      </MemoryRouter>
    );
  };

  it('should render the organization name when organization exists', () => {
    const orgId = 'test-org-id';
    const orgName = 'Test Organization';
    const orgData = createMockOrganization(orgId, orgName);

    mountOrgHead(createInitialState(), ['/team'], orgId, orgData);

    cy.contains(orgName).should('be.visible');
  });

  it('should render product name fallback when organization does not exist', () => {
    mountOrgHead(createInitialState(), ['/team']);
    // The component should render - it will show product name from API_CONFIG
    // Note: The actual product name depends on API_CONFIG, which should be available
    cy.get('h6, [variant="h6"]').should('be.visible');
  });

  it('should render product name fallback when orgId is not set', () => {
    mountOrgHead(createInitialState(), ['/team'], undefined);
    // The component should render - it will show product name from API_CONFIG
    cy.get('h6, [variant="h6"]').should('be.visible');
  });

  it('should show settings and members buttons when on team screen and user is admin', () => {
    const orgId = 'test-org-id';
    const orgName = 'Test Organization';
    const orgData = createMockOrganization(orgId, orgName);

    mountOrgHead(createInitialState(), ['/team'], orgId, orgData, true);

    // Check for settings and members icon buttons (both should be visible for admin)
    // MUI IconButtons contain SVG icons as children
    cy.get('button').should('have.length.at.least', 2);
    // Verify that buttons contain SVG elements (icon buttons should have SVG children)
    cy.get('button').should('be.visible');
    cy.get('button svg').should('have.length.at.least', 2);
  });

  it('should show only members button (not settings) when on team screen and user is not admin', () => {
    const orgId = 'test-org-id';
    const orgName = 'Test Organization';
    const orgData = createMockOrganization(orgId, orgName);

    mountOrgHead(createInitialState(), ['/team'], orgId, orgData, false);

    // Should only have members button, not settings button
    cy.get('button').should('have.length', 1);
    cy.get('button').should('be.visible');
    cy.get('button svg').should('have.length', 1);
  });

  it('should not show settings and members buttons when not on team screen', () => {
    const orgId = 'test-org-id';
    const orgName = 'Test Organization';
    const orgData = createMockOrganization(orgId, orgName);

    mountOrgHead(createInitialState(), ['/project'], orgId, orgData);

    // Should only render the Typography, no buttons
    cy.contains(orgName).should('be.visible');
    cy.get('button').should('not.exist');
  });

  it('should open TeamDialog when settings button is clicked (admin only)', () => {
    const orgId = 'test-org-id';
    const orgName = 'Test Organization';
    const orgData = createMockOrganization(orgId, orgName);

    mountOrgHead(createInitialState(), ['/team'], orgId, orgData, true);

    // Find and click the first button (settings button)
    // The settings button is the first IconButton rendered (only visible for admin)
    cy.get('button').first().click();

    // TeamDialog should be open (check for a dialog or form element)
    cy.get('[role="dialog"]').should('be.visible');
  });

  it('should open members dialog when members button is clicked (admin)', () => {
    const orgId = 'test-org-id';
    const orgName = 'Test Organization';
    const orgData = createMockOrganization(orgId, orgName);

    mountOrgHead(createInitialState(), ['/team'], orgId, orgData, true);

    // Find and click the second button (members button)
    // The members button is the second IconButton rendered (when admin)
    cy.get('button').eq(1).click();

    // BigDialog should be open with members title
    cy.contains('Members of Test Organization').should('be.visible');
    cy.get('[role="dialog"]').should('be.visible');
  });

  it('should open members dialog when members button is clicked (non-admin)', () => {
    const orgId = 'test-org-id';
    const orgName = 'Test Organization';
    const orgData = createMockOrganization(orgId, orgName);

    mountOrgHead(createInitialState(), ['/team'], orgId, orgData, false);

    // Find and click the button (members button - only button for non-admin)
    cy.get('button').first().click();

    // BigDialog should be open with members title
    cy.contains('Members of Test Organization').should('be.visible');
    cy.get('[role="dialog"]').should('be.visible');
  });

  it('should close TeamDialog when editOpen is set to false (admin only)', () => {
    const orgId = 'test-org-id';
    const orgName = 'Test Organization';
    const orgData = createMockOrganization(orgId, orgName);

    mountOrgHead(createInitialState(), ['/team'], orgId, orgData, true);

    // Open the dialog (settings button is first for admin)
    cy.get('button').first().click();

    cy.get('[role="dialog"]').should('be.visible');

    // Close the dialog by clicking the cancel button (identified by id)
    cy.get('[role="dialog"]').within(() => {
      cy.get('#teamCancel').should('be.visible').click();
    });

    // Dialog should close
    cy.wait(100);
    cy.get('[role="dialog"]').should('not.exist');
  });

  it('should handle organization name with long text and ellipsis', () => {
    const orgId = 'test-org-id';
    const longOrgName = 'A'.repeat(200); // Very long name
    const orgData = createMockOrganization(orgId, longOrgName);

    mountOrgHead(createInitialState(), ['/team'], orgId, orgData);

    // Should render but with ellipsis due to text overflow
    cy.contains(longOrgName.substring(0, 50)).should('be.visible');
  });

  it('should use mobile width styling when isMobileWidth returns true', () => {
    // Set viewport to mobile size (below 'sm' breakpoint which is 600px)
    cy.viewport(400, 800);

    const orgId = 'test-org-id';
    const orgName = 'Test Organization';
    const orgData = createMockOrganization(orgId, orgName);

    mountOrgHead(createInitialState(), ['/team'], orgId, orgData);

    // The component should render (mobile width affects maxWidth CSS)
    cy.contains(orgName).should('be.visible');
    // Verify the Typography has mobile width constraint (maxWidth: 170px on mobile)
    cy.contains(orgName)
      .should('have.css', 'max-width')
      .and('match', /170px|10.625rem/);
  });

  it('should use desktop width styling when not on mobile device', () => {
    // Set viewport to desktop size (above 'sm' breakpoint)
    cy.viewport(1024, 768);

    const orgId = 'test-org-id';
    const orgName = 'Test Organization';
    const orgData = createMockOrganization(orgId, orgName);

    mountOrgHead(createInitialState(), ['/team'], orgId, orgData);

    // The component should render
    cy.contains(orgName).should('be.visible');
    // Verify the Typography has desktop width constraint (maxWidth: 800px on desktop)
    cy.contains(orgName)
      .should('have.css', 'max-width')
      .and('match', /800px|50rem/);
  });

  it('should display product name instead of organization name when on switch-teams route', () => {
    const orgId = 'test-org-id';
    const orgName = 'Test Organization';
    const orgData = createMockOrganization(orgId, orgName);

    // Mount on switch-teams route with organization data
    mountOrgHead(createInitialState(), ['/switch-teams'], orgId, orgData);

    // Should display product name (from API_CONFIG), not the organization name
    // The product name defaults to "Audio Project Manager" or "Audio Project Manager Desktop"
    cy.contains('Audio Project Manager').should('be.visible');
    // Should NOT display the organization name
    cy.contains(orgName).should('not.exist');
  });

  it('should not display organization name that starts with > or ends with <', () => {
    const orgId = 'test-org-id';
    // Test with name that starts with >
    const orgNameWithPrefix = '>Test Organization';
    const orgDataWithPrefix = createMockOrganization(orgId, orgNameWithPrefix);

    mountOrgHead(createInitialState(), ['/team'], orgId, orgDataWithPrefix);

    // The displayed name should not start with >
    cy.get('h6, [variant="h6"]')
      .should('be.visible')
      .then(($el) => {
        const displayedText = $el.text();
        expect(displayedText.startsWith('>')).to.be.false;
        expect(displayedText).to.equal('Test Organization');
      });

    // Test with name that ends with <
    const orgNameWithSuffix = 'Test Organization<';
    const orgDataWithSuffix = createMockOrganization(orgId, orgNameWithSuffix);

    mountOrgHead(createInitialState(), ['/team'], orgId, orgDataWithSuffix);

    // The displayed name should not end with <
    cy.get('h6, [variant="h6"]')
      .should('be.visible')
      .then(($el) => {
        const displayedText = $el.text();
        expect(displayedText.endsWith('<')).to.be.false;
        expect(displayedText).to.equal('Test Organization');
      });
    const orgNameWithBoth = '>Test Organization<';
    const orgDataWithBoth = createMockOrganization(orgId, orgNameWithBoth);

    mountOrgHead(createInitialState(), ['/team'], orgId, orgDataWithBoth);

    // The displayed name should not start with > or end with <
    cy.get('h6, [variant="h6"]')
      .should('be.visible')
      .then(($el) => {
        const displayedText = $el.text();
        expect(displayedText.startsWith('>')).to.be.false;
        expect(displayedText.endsWith('<')).to.be.false;
        expect(displayedText).to.equal('Test Organization');
      });
  });
});
