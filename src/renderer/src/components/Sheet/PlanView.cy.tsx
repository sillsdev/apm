import React from 'react';
import { PlanView } from './PlanView';
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
import { MemoryRouter } from 'react-router-dom';
import {
  ISheet,
  PassageTypeEnum,
  IwsKind,
  SheetLevel,
  SectionD,
} from '../../model';
import { RecordIdentity } from '@orbit/records';

// Mock dependencies
const createMockLiveQuery = (data: any[] = []) => ({
  subscribe: (callback: (update: any) => void) => {
    // Return an unsubscribe function
    return () => {};
  },
  query: () => data,
});

// Create mock memory that can return section and organization records
const createMockMemory = (
  sections: SectionD[] = [],
  organizations: any[] = []
): Memory => {
  return {
    cache: {
      query: (queryFn: (q: any) => any) => {
        const mockQueryBuilder = {
          findRecord: ({ type, id }: { type: string; id: string }) => {
            if (type === 'section') {
              return sections.find((s) => s.id === id);
            }
            if (type === 'organization') {
              return organizations.find((org) => org.id === id);
            }
            return undefined;
          },
          findRecords: (type: string) => {
            if (type === 'section') {
              return sections;
            }
            if (type === 'organization') {
              return organizations;
            }
            return [];
          },
        };
        return queryFn(mockQueryBuilder);
      },
      liveQuery: (queryFn: (q: any) => any) => {
        const mockQueryBuilder = {
          findRecords: (type: string) => {
            if (type === 'section') {
              return sections;
            }
            if (type === 'organization') {
              return organizations;
            }
            return [];
          },
        };
        const result = queryFn(mockQueryBuilder);
        return createMockLiveQuery(result);
      },
      patch: () => {}, // Add a simple patch method
    },
    update: () => {},
  } as unknown as Memory;
};

const mockMemory = createMockMemory();

const mockCoordinator = {
  getSource: () => mockMemory,
} as unknown as Coordinator;

// Mock Redux selectors
const mockPlanSheetStrings = new LocalizedStrings({
  en: {
    published: 'Published',
    unknownBook: 'Unknown Book',
  },
});

// Create a mock reducer that returns our test strings
const mockStringsReducer = () => {
  const initialState = localizationReducer(undefined, { type: '@@INIT' });
  return {
    ...initialState,
    loaded: true,
    lang: 'en',
    planSheet: mockPlanSheetStrings,
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

describe('PlanView', () => {
  let mockHandleOpenPublishDialog: ReturnType<typeof cy.stub>;
  let mockHandleGraphic: ReturnType<typeof cy.stub>;

  beforeEach(() => {
    mockHandleOpenPublishDialog = cy.stub().as('handleOpenPublishDialog');
    mockHandleGraphic = cy.stub().as('handleGraphic');
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
    setTab: cy.stub(),
    ...overrides,
  });

  const createMockRecordIdentity = (
    id: string,
    type: string = 'section'
  ): RecordIdentity => ({
    id,
    type,
  });

  const createMockSection = (overrides: Partial<ISheet> = {}): ISheet => {
    return {
      level: SheetLevel.Section,
      kind: IwsKind.Section,
      sectionSeq: 1,
      passageSeq: 1,
      sectionId: createMockRecordIdentity('section-1', 'section'),
      title: 'Test Section',
      passageType: PassageTypeEnum.PASSAGE,
      deleted: false,
      filtered: false,
      published: [],
      ...overrides,
    } as ISheet;
  };

  const createMockPassage = (overrides: Partial<ISheet> = {}): ISheet => {
    return {
      level: SheetLevel.Passage,
      kind: IwsKind.Passage,
      sectionSeq: 1,
      passageSeq: 1,
      book: 'GEN',
      reference: '1:1',
      passageType: PassageTypeEnum.PASSAGE,
      deleted: false,
      filtered: false,
      published: [],
      passage: {
        id: 'passage-1',
        type: 'passage',
        attributes: {
          sequencenum: 1,
          book: 'GEN',
          reference: '1:1',
          state: '',
          hold: false,
          title: '',
          lastComment: '',
          stepComplete: '{}',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
        keys: {
          remoteId: 'passage-remote-1',
        },
      },
      ...overrides,
    } as ISheet;
  };

  const createMockBookNameMap = (): Record<string, string> => ({
    GEN: 'Genesis',
    MAT: 'Matthew',
  });

  // Helper function to mount PlanView with required providers
  const mountPlanView = (
    props: {
      rowInfo: ISheet[];
      bookMap: Record<string, string>;
      publishingView: boolean;
      handleOpenPublishDialog: (index: number) => void;
      handleGraphic: (index: number) => void;
    },
    planContextOverrides = {},
    globalStateOverrides = {},
    initialEntries: string[] = ['/project/test-prj'],
    sections: SectionD[] = [],
    organizationName: string = 'Test Organization'
  ) => {
    const initialState = createInitialState(globalStateOverrides);
    const planContextState = createMockPlanContextState(planContextOverrides);

    // Create mock organizations for orbit data
    const mockOrganizations = [
      {
        id: 'org-1',
        type: 'organization',
        attributes: {
          name: organizationName,
          websiteUrl: '',
          logoUrl: '',
          publicByDefault: false,
          allUsersPolicy: '',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
      },
    ];

    const memory = createMockMemory(sections, mockOrganizations);

    // Mock the cache to return organizations
    memory.cache.query = (queryFn: (q: any) => any) => {
      const mockQueryBuilder = {
        findRecord: ({ type, id }: { type: string; id: string }) => {
          if (type === 'section') {
            return sections.find((s) => s.id === id);
          }
          if (type === 'organization') {
            return mockOrganizations.find((org) => org.id === id);
          }
          return undefined;
        },
        findRecords: (type: string) => {
          if (type === 'section') {
            return sections;
          }
          if (type === 'organization') {
            return mockOrganizations;
          }
          return [];
        },
      };
      return queryFn(mockQueryBuilder);
    };

    cy.mount(
      <MemoryRouter initialEntries={initialEntries}>
        <Provider store={mockStore}>
          <GlobalProvider init={{ ...initialState, memory }}>
            <DataProvider dataStore={memory}>
              <PlanContext.Provider
                value={{
                  state: planContextState as any,
                  setState: cy.stub(),
                }}
              >
                <PlanView {...props} />
              </PlanContext.Provider>
            </DataProvider>
          </GlobalProvider>
        </Provider>
      </MemoryRouter>
    );
  };

  it('should render Grid container', () => {
    const rowInfo: ISheet[] = [];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: false,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    cy.get('div[class*="MuiGrid-container"]', { timeout: 5000 }).should(
      'exist'
    );
  });

  it('should render section with title when passageType is BOOK', () => {
    const section = createMockSection({
      passageType: PassageTypeEnum.BOOK,
      title: 'Genesis',
    });
    const rowInfo: ISheet[] = [section];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: false,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    cy.contains('Genesis').should('be.visible');
    cy.get('h5[class*="MuiTypography-h5"]', { timeout: 5000 })
      .contains('Genesis')
      .should('be.visible');
  });

  it('should render section with title and padding when passageType is ALTBOOK', () => {
    const section = createMockSection({
      passageType: PassageTypeEnum.ALTBOOK,
      title: 'Alternative Book',
    });
    const rowInfo: ISheet[] = [section];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: false,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    cy.contains('Alternative Book').should('be.visible');
    cy.get('h5[class*="MuiTypography-h5"]', { timeout: 5000 })
      .contains('Alternative Book')
      .should('be.visible');
  });

  it('should render GraphicAvatar when publishingView is true and kind is Section', () => {
    const section = createMockSection({
      graphicUri: 'https://example.com/image.png',
      sectionSeq: 1,
    });
    const rowInfo: ISheet[] = [section];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: true,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    cy.get('div[class*="MuiAvatar-root"]', { timeout: 5000 }).should(
      'be.visible'
    );
  });

  it('should not render GraphicAvatar when publishingView is false', () => {
    const section = createMockSection({
      graphicUri: 'https://example.com/image.png',
    });
    const rowInfo: ISheet[] = [section];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: false,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    cy.get('div[class*="MuiAvatar-root"]').should('not.exist');
  });

  it('should call handleGraphic when GraphicAvatar is clicked', () => {
    const section = createMockSection({
      graphicUri: 'https://example.com/image.png',
      sectionSeq: 1,
    });
    const rowInfo: ISheet[] = [section];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: true,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    cy.get('div[class*="MuiAvatar-root"]', { timeout: 5000 }).click();
    cy.wrap(mockHandleGraphic).should('have.been.calledWith', 0);
  });

  it('should render publish button when publishingView is true and passageType is PASS', () => {
    const section = createMockSection({
      passageType: PassageTypeEnum.PASSAGE as any, // PASS is string 'PASS'
    });
    const rowInfo: ISheet[] = [section];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: true,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    cy.contains('button', 'Published', { timeout: 5000 }).should('be.visible');
    cy.get('svg[data-testid="PublicOutlinedIcon"]').should('exist');
  });

  it('should not render publish button when publishingView is false', () => {
    const section = createMockSection({
      passageType: PassageTypeEnum.PASSAGE as any,
    });
    const rowInfo: ISheet[] = [section];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: false,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    cy.contains('button', 'Published').should('not.exist');
  });

  it('should call handleOpenPublishDialog when publish button is clicked', () => {
    const section = createMockSection({
      passageType: PassageTypeEnum.PASSAGE as any,
    });
    const rowInfo: ISheet[] = [section];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: true,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    cy.contains('button', 'Published', { timeout: 5000 }).click();
    cy.wrap(mockHandleOpenPublishDialog).should('have.been.calledWith', 0);
  });

  it('should render PassageCard when kind is Passage', () => {
    const passage = createMockPassage();
    const rowInfo: ISheet[] = [passage];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: false,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    cy.get('div[class*="MuiCard-root"]', { timeout: 5000 }).should(
      'be.visible'
    );
  });

  it('should not show assign section in PassageCard for personal projects', () => {
    const passage = createMockPassage({
      assign: createMockRecordIdentity('user-1', 'user'),
    });
    const rowInfo: ISheet[] = [passage];
    const bookMap = createMockBookNameMap();
    const personalOrgName = '>My Personal<';

    mountPlanView(
      {
        rowInfo,
        bookMap,
        publishingView: false,
        handleOpenPublishDialog: mockHandleOpenPublishDialog,
        handleGraphic: mockHandleGraphic,
      },
      {},
      { organization: 'org-1' }, // Use the mock org ID
      ['/project/test-prj'],
      [],
      personalOrgName // This creates an organization with name 'Personal'
    );

    cy.wait(100);
    cy.get('div[class*="MuiCard-root"]', { timeout: 5000 }).should(
      'be.visible'
    );
    // Should not show "Unassigned" text
    cy.contains('Unassigned').should('not.exist');
    // Should not show Person icon
    cy.get('svg[data-testid="PersonIcon"]').should('not.exist');
  });

  it('should render multiple items in rowInfo', () => {
    const section = createMockSection({
      sectionId: createMockRecordIdentity('section-1', 'section'),
      passageType: PassageTypeEnum.BOOK,
      title: 'Section 1',
    });
    const passage = createMockPassage({ book: 'GEN', reference: '1:1' });
    const rowInfo: ISheet[] = [section, passage];
    const bookMap = createMockBookNameMap();

    mountPlanView(
      {
        rowInfo,
        bookMap,
        publishingView: false,
        handleOpenPublishDialog: mockHandleOpenPublishDialog,
        handleGraphic: mockHandleGraphic,
      },
      {},
      {},
      ['/project/test-prj'],
      []
    );

    cy.wait(100);
    cy.contains('Section 1').should('be.visible');
    cy.get('div[class*="MuiCard-root"]', { timeout: 5000 }).should(
      'be.visible'
    );
  });

  it('should handle empty rowInfo', () => {
    const rowInfo: ISheet[] = [];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: false,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    cy.get('div[class*="MuiGrid-container"]', { timeout: 5000 }).should(
      'exist'
    );
    // Should not render any sections or passages
    cy.get('h5[class*="MuiTypography-h5"]').should('not.exist');
    cy.get('div[class*="MuiCard-root"]').should('not.exist');
  });

  it('should return null for rows with kind other than IwsKind.Section, IwsKind.Passage, or IwsKind.SectionPassage', () => {
    const invalidRow = {
      ...createMockSection(),
      kind: 99 as any, // Invalid kind
    };
    const rowInfo: ISheet[] = [invalidRow];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: false,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    // Should not render anything for invalid kind
    cy.get('h5[class*="MuiTypography-h5"]').should('not.exist');
    cy.get('div[class*="MuiCard-root"]').should('not.exist');
  });

  it('should indent second book when rendering multiple BOOK types', () => {
    const book1 = createMockSection({
      passageType: PassageTypeEnum.BOOK,
      title: 'Book 1',
    });
    const book2 = createMockSection({
      passageType: PassageTypeEnum.BOOK,
      title: 'Book 2',
    });
    const rowInfo: ISheet[] = [book1, book2];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: true,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    // Both books should be visible
    cy.contains('Book 1').should('be.visible');
    cy.contains('Book 2').should('be.visible');
    // Second book's GraphicAvatar should have margin-left
    cy.get('div[class*="MuiAvatar-root"]')
      .eq(1)
      .should('have.css', 'margin-left');
  });

  it('should render PassageCard for IwsKind.Passage', () => {
    const passageRow = createMockPassage({
      kind: IwsKind.Passage,
    });
    const rowInfo: ISheet[] = [passageRow];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: false,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    // Should render PassageCard for IwsKind.Passage
    cy.get('div[class*="MuiCard-root"]').should('be.visible');
  });

  it('should render PassageCard for IwsKind.SectionPassage', () => {
    const sectionPassageRow = createMockPassage({
      kind: IwsKind.SectionPassage,
    });
    const rowInfo: ISheet[] = [sectionPassageRow];
    const bookMap = createMockBookNameMap();

    mountPlanView({
      rowInfo,
      bookMap,
      publishingView: false,
      handleOpenPublishDialog: mockHandleOpenPublishDialog,
      handleGraphic: mockHandleGraphic,
    });

    cy.wait(100);
    // Should render PassageCard for IwsKind.SectionPassage
    cy.get('div[class*="MuiCard-root"]').should('be.visible');
  });
});
