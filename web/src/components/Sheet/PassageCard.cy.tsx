import React from 'react';
import { PassageCard } from './PassageCard';
import { ISheet, PassageTypeEnum, IwsKind, SheetLevel } from '../../model';
import { RecordIdentity } from '@orbit/records';
import { GlobalProvider, GlobalState } from '../../context/GlobalContext';
import { PlanContext, ICtxState } from '../../context/PlanContext';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import DataProvider from '../../hoc/DataProvider';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../auth/bugsnagClient';
import localizationReducer from '../../store/localization/reducers';
import LocalizedStrings from 'react-localization';

// Mock dependencies
// Create a mock liveQuery object with subscribe and query methods
const createMockLiveQuery = () => ({
  subscribe: () => () => {}, // Returns an unsubscribe function
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

const mockPlanSheetStrings = new LocalizedStrings({
  en: {
    unknownBook: 'Unknown Book',
    chapter: 'Chapter',
    verse: 'Verse',
  },
});

const mockBooksReducer = () => ({
  map: {
    GEN: 'Genesis',
    EXO: 'Exodus',
    MAT: 'Matthew',
    JOH: 'John',
  },
});

// Create a mock reducer for Redux store
const mockStringsReducer = () => {
  const initialState = localizationReducer(undefined, { type: '@@INIT' });

  // Create a simple mock LocalizedStrings-like object for cards
  const mockCardsStrings: any = {
    ...initialState.cards,
    unassigned: 'Unassigned',
    setLanguage: () => {}, // Mock the setLanguage method
    getString: (key: string): string => (mockCardsStrings as any)[key] || key,
  };

  return {
    ...initialState,
    loaded: true,
    lang: 'en',
    cards: mockCardsStrings,
    planSheet: mockPlanSheetStrings,
  };
};

// Create store with mock reducer
const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
    books: mockBooksReducer,
    orbit: () => ({}),
    upload: () => ({}),
    paratext: () => ({}),
    importexport: () => ({}),
    auth: () => ({}),
  })
);

describe('PassageCard', { tags: '@smoke' }, () => {
  let mockHandleViewStep: ReturnType<typeof cy.stub>;

  beforeEach(() => {
    // Create stubs for each test
    mockHandleViewStep = cy.stub().as('handleViewStep');
    // Hold the media url request open so the button stays in its playing state
    cy.intercept('GET', '**/mediafiles/*/fileurl', {
      delay: 30000,
      body: { data: { attributes: { 'audio-url': '' } } },
    }).as('fileUrl');
  });

  const createInitialState = (
    overrides: Partial<GlobalState> = {}
  ): GlobalState => ({
    coordinator: mockCoordinator,
    errorReporter: bugsnagClient,
    fingerprint: 'test-fingerprint',
    memory: mockMemory,
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
    addStoryOrPassage: false,
    ...overrides,
  });

  const createPlanContextState = (
    overrides: Partial<ICtxState> = {}
  ): ICtxState => ({
    connected: true,
    mediafiles: [],
    discussions: [],
    groupmemberships: [],
    scripture: true,
    flat: false,
    shared: false,
    publishingOn: true,
    hidePublishing: true,
    canEditSheet: false,
    canEditAudio: false,
    canPublish: false,
    sectionArr: [],
    setSectionArr: () => {},
    togglePublishing: () => {},
    setCanAddPublishing: () => {},
    tab: 0,
    setTab: () => {},
    ...overrides,
  });

  // Helper function to mount PassageCards with required providers
  const mountPassageCards = (
    cardInfos: ISheet[],
    props: {
      handleViewStep: () => void;
      isPersonal?: boolean;
    },
    planContextOverrides: Partial<ICtxState> = {}
  ) => {
    const initialState = createInitialState();
    const planContextState = createPlanContextState(planContextOverrides);
    const mockPlanContextValue = {
      state: planContextState,
      setState: cy.stub(),
    };
    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider init={initialState}>
          <DataProvider dataStore={mockMemory}>
            <PlanContext.Provider value={mockPlanContextValue as any}>
              {cardInfos.map((cardInfo, i) => (
                <PassageCard
                  key={i}
                  cardInfo={cardInfo}
                  handleViewStep={props.handleViewStep}
                  isPersonal={props.isPersonal}
                />
              ))}
            </PlanContext.Provider>
          </DataProvider>
        </GlobalProvider>
      </Provider>
    );
  };

  const mountPassageCard = (
    cardInfo: ISheet,
    props: Parameters<typeof mountPassageCards>[1],
    planContextOverrides: Partial<ICtxState> = {}
  ) => mountPassageCards([cardInfo], props, planContextOverrides);

  const createMockSheet = (overrides: Partial<ISheet> = {}): ISheet => {
    return {
      level: SheetLevel.Passage,
      kind: IwsKind.Passage,
      sectionSeq: 1,
      passageSeq: 1,
      book: 'GEN',
      reference: '1:1',
      comment: 'Test comment',
      passageType: PassageTypeEnum.PASSAGE,
      deleted: false,
      filtered: false,
      published: [],
      step: 'Step 1',
      color: undefined,
      graphicUri: undefined,
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
      },
      ...overrides,
    };
  };

  const createMockRecordIdentity = (
    id: string,
    type: string = 'passage'
  ): RecordIdentity => ({
    id,
    type,
  });

  it('should render card with basic information', () => {
    const cardInfo = createMockSheet();
    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    // Should render the card
    cy.get('div[class*="MuiCard-root"]').should('be.visible');
    // Should show book name and reference
    cy.contains('Genesis 1:1').should('be.visible');
    // Should show comment
    cy.contains('Test comment').should('be.visible');
    // Should show step button
    cy.contains('Step 1').should('be.visible');
  });

  it('should display passage reference when passageType is PASSAGE', () => {
    const cardInfo = createMockSheet({
      book: 'MAT',
      passage: {
        id: 'passage-1',
        type: 'passage',
        attributes: {
          sequencenum: 1,
          book: 'MAT',
          reference: '5:3',
          state: '',
          hold: false,
          title: '',
          lastComment: '',
          stepComplete: '{}',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
      },
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    // Should show "Matthew 5:3" format
    cy.contains('Matthew').should('be.visible');
    cy.contains('5:3').should('be.visible');
  });

  it('should not display book name for non-scripture projects', () => {
    const cardInfo = createMockSheet({
      book: 'MAT',
      passage: {
        id: 'passage-1',
        type: 'passage',
        attributes: {
          sequencenum: 1,
          book: 'MAT',
          reference: '5:3',
          state: '',
          hold: false,
          title: '',
          lastComment: '',
          stepComplete: '{}',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
      },
    });

    mountPassageCard(
      cardInfo,
      {
        handleViewStep: mockHandleViewStep,
      },
      { scripture: false }
    );

    // Should show only reference, not book name
    cy.contains('5:3').should('be.visible');
    // Should not show book name (Matthew)
    cy.contains('Matthew').should('not.exist');
  });

  it('should render card with reference only for non-scripture projects', () => {
    const cardInfo = createMockSheet({
      book: 'GEN',
      reference: '1:1',
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
      },
    });

    mountPassageCard(
      cardInfo,
      {
        handleViewStep: mockHandleViewStep,
      },
      { scripture: false }
    );

    // Should render the card
    cy.get('div[class*="MuiCard-root"]').should('be.visible');
    // Should show reference only, not book name
    cy.contains('1:1').should('be.visible');
    // Should not show book name
    cy.contains('Genesis').should('not.exist');
    // Should show comment
    cy.contains('Test comment').should('be.visible');
    // Should show step button
    cy.contains('Step 1').should('be.visible');
  });

  it('should use noteTitle from sharedResource when available', () => {
    const cardInfo = createMockSheet({
      sharedResource: {
        id: 'shared-1',
        type: 'sharedresource',
        attributes: {
          title: 'Note Title',
          description: 'Note description',
          languagebcp47: 'en',
          termsOfUse: '',
          keywords: '',
          note: true,
          linkurl: '',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
        relationships: {
          passage: { data: { id: 'passage-1', type: 'passage' } },
          cluster: { data: null },
          artifactCategory: { data: null },
          titleMediafile: { data: null },
          lastModifiedByUser: { data: null },
        },
      },
      passage: {
        id: 'passage-1',
        type: 'passage',
        attributes: {
          sequencenum: 1,
          book: 'GEN',
          reference: 'NOTE|Note Title',
          state: '',
          hold: false,
          title: '',
          lastComment: '',
          stepComplete: '{}',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
      },
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    // Should show note title instead of passage reference
    cy.contains('Note Title').should('be.visible');
  });

  it('should show the passage comment, not the sharedResource description', () => {
    const cardInfo = createMockSheet({
      sharedResource: {
        id: 'shared-1',
        type: 'sharedresource',
        attributes: {
          title: 'Note Title',
          description: 'Shared resource description',
          languagebcp47: 'en',
          termsOfUse: '',
          keywords: '',
          note: true,
          linkurl: '',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
        relationships: {
          passage: { data: { id: 'passage-1', type: 'passage' } },
          cluster: { data: null },
          artifactCategory: { data: null },
          titleMediafile: { data: null },
          lastModifiedByUser: { data: null },
        },
      },
      passage: {
        id: 'passage-1',
        type: 'passage',
        attributes: {
          sequencenum: 1,
          book: 'GEN',
          reference: 'NOTE|Note Title',
          state: '',
          hold: false,
          title: '',
          lastComment: '',
          stepComplete: '{}',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
      },
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    // Only the passage-level description is shown
    cy.contains('Test comment').should('be.visible');
    cy.contains('Shared resource description').should('not.exist');
  });

  it('should show play button when mediaId exists and not playing', () => {
    const cardInfo = createMockSheet({
      mediaId: createMockRecordIdentity('media-1', 'mediafile'),
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    cy.get('[data-testid="play-button"]').should('be.visible');
    cy.get('svg[data-testid="PlayArrowIcon"]').should('exist');
  });

  it('should show pause icon after the play button is clicked', () => {
    const cardInfo = createMockSheet({
      mediaId: createMockRecordIdentity('media-1', 'mediafile'),
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    cy.get('[data-testid="play-button"]').click();
    // The response is held open, so check the request rather than wait on it
    cy.get('@fileUrl.all').should('have.length', 1);
    cy.get('svg[data-testid="PauseIcon"]').should('exist');
    cy.get('svg[data-testid="PlayArrowIcon"]').should('not.exist');
  });

  it('should show play icon again when the pause button is clicked', () => {
    const cardInfo = createMockSheet({
      mediaId: createMockRecordIdentity('media-1', 'mediafile'),
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    cy.get('[data-testid="play-button"]').click();
    cy.get('svg[data-testid="PauseIcon"]').should('exist');
    cy.get('[data-testid="play-button"]').click();
    cy.get('svg[data-testid="PlayArrowIcon"]').should('exist');
    cy.get('svg[data-testid="PauseIcon"]').should('not.exist');
  });

  it('should stop the playing passage when another passage is played', () => {
    const first = createMockSheet({
      mediaId: createMockRecordIdentity('media-1', 'mediafile'),
    });
    const second = createMockSheet({
      mediaId: createMockRecordIdentity('media-2', 'mediafile'),
      passage: { ...first.passage!, id: 'passage-2' },
    });

    mountPassageCards([first, second], {
      handleViewStep: mockHandleViewStep,
    });

    cy.get('[data-testid="play-button"]').eq(0).click();
    cy.get('[data-testid="play-button"]')
      .eq(0)
      .find('svg[data-testid="PauseIcon"]')
      .should('exist');

    cy.get('[data-testid="play-button"]').eq(1).click();
    cy.get('[data-testid="play-button"]')
      .eq(1)
      .find('svg[data-testid="PauseIcon"]')
      .should('exist');
    cy.get('[data-testid="play-button"]')
      .eq(0)
      .find('svg[data-testid="PlayArrowIcon"]')
      .should('exist');
  });

  it('should not show play button when no mediaId exists', () => {
    const cardInfo = createMockSheet({
      mediaId: undefined,
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    cy.get('[data-testid="play-button"]').should('not.exist');
  });

  it('should show TaskAvatar when assign exists', () => {
    const cardInfo = createMockSheet({
      assign: createMockRecordIdentity('user-1', 'user'),
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
      isPersonal: false,
    });

    // TaskAvatar should be rendered (it may render UserAvatar or group avatar)
    // Check that "Unassigned" is not shown
    cy.contains('Unassigned').should('not.exist');
  });

  it('should not show assign section when assign does not exist', () => {
    const cardInfo = createMockSheet({
      assign: undefined,
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
      isPersonal: false,
    });

    // Should not show "Unassigned" text
    cy.contains('Unassigned').should('not.exist');
    // Should not show NoAccounts icon
    cy.get('svg[data-testid="NoAccountsIcon"]').should('not.exist');
  });

  it('should not show assign section for personal projects when assign exists', () => {
    const cardInfo = createMockSheet({
      assign: createMockRecordIdentity('user-1', 'user'),
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
      isPersonal: true,
    });

    // Should not show TaskAvatar
    cy.contains('Unassigned').should('not.exist');
    // Should not show NoAccounts icon
    cy.get('svg[data-testid="NoAccountsIcon"]').should('not.exist');
    // Assign section should not be visible
    cy.get('div[class*="MuiCard-root"]').should('not.contain', 'Unassigned');
  });

  it('should not show assign section for personal projects when assign does not exist', () => {
    const cardInfo = createMockSheet({
      assign: undefined,
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
      isPersonal: true,
    });

    // Should not show "Unassigned" text
    cy.contains('Unassigned').should('not.exist');
    // Should not show NoAccounts icon
    cy.get('svg[data-testid="NoAccountsIcon"]').should('not.exist');
  });

  it('should call handleViewStep when step button is clicked', () => {
    const cardInfo = createMockSheet({
      step: 'Transcribe',
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    // Find the button containing the step text
    cy.contains('button', 'Transcribe').click();
    cy.wrap(mockHandleViewStep).should('have.been.called');
  });

  it('should display step text in button', () => {
    const cardInfo = createMockSheet({
      step: 'Review',
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    cy.contains('button', 'Review').should('be.visible');
  });

  it('should show chevron icon in step button', () => {
    const cardInfo = createMockSheet();

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    // Should show ChevronRight icon in the button
    cy.get('svg[data-testid="ChevronRightIcon"]').should('exist');
  });

  it('should handle comment from reference split when noteTitle exists', () => {
    const cardInfo = createMockSheet({
      reference: 'NOTE|This is a note comment',
      sharedResource: {
        id: 'shared-1',
        type: 'sharedresource',
        attributes: {
          title: 'Note Title',
          description: '',
          languagebcp47: 'en',
          termsOfUse: '',
          keywords: '',
          note: true,
          linkurl: '',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
        relationships: {
          passage: { data: { id: 'passage-1', type: 'passage' } },
          cluster: { data: null },
          artifactCategory: { data: null },
          titleMediafile: { data: null },
          lastModifiedByUser: { data: null },
        },
      },
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    // Should show comment from reference split
    cy.contains('This is a note comment').should('be.visible');
  });

  it('should use cardInfo.comment when no sharedResource description or reference split', () => {
    const cardInfo = createMockSheet({
      comment: 'Direct comment',
      sharedResource: undefined,
      reference: '1:1',
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    cy.contains('Direct comment').should('be.visible');
  });

  it('should show non-breaking space when no comment available', () => {
    const cardInfo = createMockSheet({
      comment: undefined,
      sharedResource: undefined,
      reference: '1:1',
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    // Comment area should exist but be empty (contains non-breaking space)
    cy.get('p[class*="MuiTypography-body2"]').should('exist');
  });

  it('should strip the type prefix from non-PASSAGE references', () => {
    const cardInfo = createMockSheet({
      passage: {
        id: 'passage-1',
        type: 'passage',
        attributes: {
          sequencenum: 1,
          book: 'GEN',
          reference: 'NOTE|Devotional Note',
          state: '',
          hold: false,
          title: '',
          lastComment: '',
          stepComplete: '{}',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
      },
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    // Non-PASSAGE types show the reference with its type prefix stripped
    cy.get('p[title="Devotional Note"]').should('be.visible');
  });

  it('should handle empty reference gracefully', () => {
    const cardInfo = createMockSheet({
      passage: {
        id: 'passage-1',
        type: 'passage',
        attributes: {
          sequencenum: 1,
          book: 'GEN',
          reference: '',
          state: '',
          hold: false,
          title: '',
          lastComment: '',
          stepComplete: '{}',
          dateCreated: '',
          dateUpdated: '',
          lastModifiedBy: 0,
        },
      },
      sharedResource: undefined,
    });

    mountPassageCard(cardInfo, {
      handleViewStep: mockHandleViewStep,
    });

    // Should render but may not show reference text
    cy.get('div[class*="MuiCard-root"]').should('be.visible');
  });

  // Tests for CHAPTERNUMBER passage type
  describe('CHAPTERNUMBER passage type', () => {
    it('should render correctly when passageType is CHAPTERNUMBER', () => {
      const cardInfo = createMockSheet({
        reference: '1',
        comment: 'Chapter Introduction',
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'CHNUM|1',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // The comment replaces the chapter number as the title
      cy.get('p[title="Chapter Introduction"]').should('be.visible');
    });

    it('should not show comment section for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        reference: '1',
        comment: 'Chapter Introduction',
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'CHNUM|1',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // Should not show separate comment section below title
      cy.get('p[class*="MuiTypography-body2"]').should('not.exist');
    });

    it('should not show assign section for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        reference: '1',
        assign: createMockRecordIdentity('user-1', 'user'),
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'CHNUM|1',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
        isPersonal: false,
      });

      // Should not show TaskAvatar or Unassigned text
      cy.contains('Unassigned').should('not.exist');
      cy.get('svg[data-testid="NoAccountsIcon"]').should('not.exist');
    });

    it('should not show step button for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        reference: '1',
        step: 'Record',
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'CHNUM|1',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // Should not show step button
      cy.contains('button', 'Record').should('not.exist');
      cy.get('svg[data-testid="ChevronRightIcon"]').should('not.exist');
    });

    it('should show speaker button when mediaId exists for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        reference: '1',
        mediaId: createMockRecordIdentity('media-1', 'mediafile'),
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'CHNUM|1',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // Should show speaker button in the centered box
      cy.get('[data-testid="speaker-button"]').should('be.visible');
      cy.get('svg[data-testid="VolumeUpIcon"]').should('exist');
      cy.get('[data-testid="play-button"]').should('not.exist');
    });

    it('should disable the speaker button after clicking it for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        reference: '1',
        mediaId: createMockRecordIdentity('media-1', 'mediafile'),
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'CHNUM|1',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      cy.get('[data-testid="speaker-button"]').click();
      cy.get('[data-testid="speaker-button"]').should('be.disabled');
      cy.get('div[class*="MuiCard-root"]').should('be.visible');
    });

    it('should show the comment as the title when comment is defined for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        reference: '1',
        comment: 'Chapter Introduction',
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'CHNUM|1',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // The comment is shown as the title
      cy.get('p[title="Chapter Introduction"]').should(
        'have.text',
        'Chapter Introduction'
      );
    });

    it('should show the chapter number as the title when comment is undefined for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        reference: '1',
        comment: undefined, // Explicitly undefined
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'CHNUM|1',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // Should show only the chapter number
      cy.get('p[title="1"]').should('be.visible').and('have.text', '1');
    });

    it('should show the chapter number as the title when comment is empty string for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        reference: '1',
        comment: '', // Empty string
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'CHNUM|1',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // Should show only the chapter number
      cy.get('p[title="1"]').should('be.visible').and('have.text', '1');
    });
  });

  // Tests for graphic rendering
  describe('Graphic rendering', () => {
    it('should show graphic avatar for NOTE type when graphicUri is provided', () => {
      const cardInfo = createMockSheet({
        graphicUri: 'https://example.com/note-image.png',
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'NOTE|Special Note',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // Should show avatar with image source
      cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
      cy.get('img[src="https://example.com/note-image.png"]').should('exist');
    });

    it('should show graphic avatar for CHAPTERNUMBER type when graphicUri is provided', () => {
      const cardInfo = createMockSheet({
        graphicUri: 'https://example.com/chapter-image.png',
        reference: '1',
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'CHNUM|1',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // Should show avatar with image source
      cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
      cy.get('img[src="https://example.com/chapter-image.png"]').should(
        'exist'
      );
    });

    it('should show string avatar for NOTE type when no graphicUri is provided', () => {
      const cardInfo = createMockSheet({
        reference: 'Special Note',
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'NOTE|Special Note',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // Should show avatar with generated text
      cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
      // Avatar should contain text (stringAvatar generates initials from the reference)
      cy.get('div[class*="MuiAvatar-root"]').should('not.be.empty');
    });

    it('should show string avatar for CHAPTERNUMBER type when no graphicUri is provided', () => {
      const cardInfo = createMockSheet({
        reference: '1',
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'CHNUM|1',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // Should show avatar with generated text
      cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
      // Avatar should contain text (stringAvatar generates initials from the reference)
      cy.get('div[class*="MuiAvatar-root"]').should('not.be.empty');
    });

    it('should apply border color styling to avatar when color is provided', () => {
      const cardInfo = createMockSheet({
        color: '#ff0000',
        reference: 'Special Note',
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'NOTE|Special Note',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // Should show avatar with border styling
      cy.get('div[class*="MuiAvatar-root"]')
        .should('be.visible')
        .and('have.css', 'border-color', 'rgb(255, 0, 0)'); // #ff0000 in rgb
    });

    it('should not show graphic for PASSAGE type', () => {
      const cardInfo = createMockSheet({
        graphicUri: 'https://example.com/image.png',
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
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // Should not show avatar for PASSAGE type
      cy.get('div[class*="MuiAvatar-root"]').should('not.exist');
    });

    it('should not show graphic for other passage types', () => {
      const cardInfo = createMockSheet({
        graphicUri: 'https://example.com/image.png',
        passage: {
          id: 'passage-1',
          type: 'passage',
          attributes: {
            sequencenum: 1,
            book: 'GEN',
            reference: 'BOOK|Genesis',
            state: '',
            hold: false,
            title: '',
            lastComment: '',
            stepComplete: '{}',
            dateCreated: '',
            dateUpdated: '',
            lastModifiedBy: 0,
          },
        },
      });

      mountPassageCard(cardInfo, {
        handleViewStep: mockHandleViewStep,
      });

      // Should not show avatar for BOOK type
      cy.get('div[class*="MuiAvatar-root"]').should('not.exist');
    });
  });
});
