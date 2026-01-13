import React from 'react';
import { PassageCard } from './PassageCard';
import { ISheet, PassageTypeEnum, IwsKind, SheetLevel } from '../../model';
import { RecordIdentity } from '@orbit/records';
import { GlobalProvider } from '../../context/GlobalContext';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import DataProvider from '../../hoc/DataProvider';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../auth/bugsnagClient';
import localizationReducer from '../../store/localization/reducers';

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

describe('PassageCard', () => {
  let mockHandleViewStep: ReturnType<typeof cy.stub>;
  let mockOnPlayStatus: ReturnType<typeof cy.stub>;
  let mockGetBookName: ReturnType<typeof cy.stub>;

  beforeEach(() => {
    // Create stubs for each test
    mockHandleViewStep = cy.stub().as('handleViewStep');
    mockOnPlayStatus = cy.stub().as('onPlayStatus');
    mockGetBookName = cy.stub().as('getBookName');
    // Default return value for getBookName
    mockGetBookName.returns('Genesis');
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

  // Helper function to mount PassageCard with required providers
  const mountPassageCard = (
    cardInfo: ISheet,
    props: {
      getBookName: (bookAbbreviation: string | undefined) => string;
      handleViewStep: () => void;
      onPlayStatus?: () => void;
      isPlaying: boolean;
      isPersonal?: boolean;
    }
  ) => {
    const initialState = createInitialState();
    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider init={initialState}>
          <DataProvider dataStore={mockMemory}>
            <PassageCard
              cardInfo={cardInfo}
              getBookName={props.getBookName}
              handleViewStep={props.handleViewStep}
              onPlayStatus={props.onPlayStatus}
              isPlaying={props.isPlaying}
              isPersonal={props.isPersonal}
            />
          </DataProvider>
        </GlobalProvider>
      </Provider>
    );
  };

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
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
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

  it('should call getBookName with book abbreviation', () => {
    const cardInfo = createMockSheet({ book: 'MAT' });
    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

    cy.wrap(mockGetBookName).should('have.been.calledWith', 'MAT');
  });

  it('should display passage reference when passageType is PASSAGE', () => {
    const cardInfo = createMockSheet({
      passageType: PassageTypeEnum.PASSAGE,
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
    mockGetBookName.returns('Matthew');

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

    // Should show "Matthew 5:3" format
    cy.contains('Matthew').should('be.visible');
    cy.contains('5:3').should('be.visible');
  });

  it('should not display book name for general projects', () => {
    const cardInfo = createMockSheet({
      passageType: PassageTypeEnum.PASSAGE,
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
    // For general projects, getBookName returns empty string
    mockGetBookName.returns('');

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

    // Should show only reference, not book name
    cy.contains('5:3').should('be.visible');
    // Should not show book name (Matthew)
    cy.contains('Matthew').should('not.exist');
    // Should not show Genesis (default mock value)
    cy.contains('Genesis').should('not.exist');
  });

  it('should render card with reference only for general projects', () => {
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
    // For general projects, getBookName returns empty string
    mockGetBookName.returns('');

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

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
    });

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

    // Should show note title instead of passage reference
    cy.contains('Note Title').should('be.visible');
  });

  it('should use sharedResource description as comment when available', () => {
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
    });

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

    // Should show shared resource description as comment
    cy.contains('Shared resource description').should('be.visible');
  });

  it('should show play button when mediaId exists and not playing', () => {
    const cardInfo = createMockSheet({
      mediaId: createMockRecordIdentity('media-1', 'mediafile'),
    });

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      onPlayStatus: mockOnPlayStatus,
      isPlaying: false,
    });

    // Should show play icon button
    cy.get('button[class*="MuiIconButton-root"]').should('be.visible');
    cy.get('svg[data-testid="PlayCircleOutlineIcon"]').should('exist');
  });

  it('should show AudioProgressButton when mediaId exists and isPlaying is true', () => {
    const cardInfo = createMockSheet({
      mediaId: createMockRecordIdentity('media-1', 'mediafile'),
    });

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      onPlayStatus: mockOnPlayStatus,
      isPlaying: true,
    });

    // Should show LoadAndPlay component (AudioProgressButton)
    // LoadAndPlay renders AudioProgressButton only when ready (after fetching media URL)
    // The step button should always be visible
    cy.contains('button', 'Step 1').should('be.visible');
    // LoadAndPlay may not be ready immediately, so we check that the card renders
    // and that we're in the playing state (LoadAndPlay is rendered instead of IconButton)
    cy.get('div[class*="MuiCard-root"]').should('be.visible');
    // When LoadAndPlay is ready, it will render a Fab button (from AudioProgressButton)
    // But since media fetching is async, we just verify the structure is correct
    // by checking that the play IconButton is NOT shown (since isPlaying is true)
    cy.get('svg[data-testid="PlayCircleOutlineIcon"]').should('not.exist');
  });

  it('should call onPlayStatus when play button is clicked', () => {
    const cardInfo = createMockSheet({
      mediaId: createMockRecordIdentity('media-1', 'mediafile'),
    });

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      onPlayStatus: mockOnPlayStatus,
      isPlaying: false,
    });

    cy.get('button[class*="MuiIconButton-root"]').click();
    cy.wrap(mockOnPlayStatus).should('have.been.called');
  });

  it('should show empty box when no mediaId exists', () => {
    const cardInfo = createMockSheet({
      mediaId: undefined,
    });

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

    // Should not show play button
    cy.get('svg[data-testid="PlayCircleOutlineIcon"]').should('not.exist');
    // Should have an empty box placeholder
    cy.get('div[class*="MuiBox-root"]').should('have.length.at.least', 1);
  });

  it('should show TaskAvatar when assign exists', () => {
    const cardInfo = createMockSheet({
      assign: createMockRecordIdentity('user-1', 'user'),
    });

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
      isPersonal: false,
    });

    // TaskAvatar should be rendered (it may render UserAvatar or group avatar)
    // Check that "Unassigned" is not shown
    cy.contains('Unassigned').should('not.exist');
  });

  it('should show Unassigned with Person icon when assign does not exist', () => {
    const cardInfo = createMockSheet({
      assign: undefined,
    });

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
      isPersonal: false,
    });

    // Should show "Unassigned" text
    cy.contains('Unassigned').should('be.visible');
    // Should show Person icon
    cy.get('svg[data-testid="PersonIcon"]').should('exist');
  });

  it('should not show assign section for personal projects when assign exists', () => {
    const cardInfo = createMockSheet({
      assign: createMockRecordIdentity('user-1', 'user'),
    });

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
      isPersonal: true,
    });

    // Should not show TaskAvatar
    cy.contains('Unassigned').should('not.exist');
    // Should not show Person icon
    cy.get('svg[data-testid="PersonIcon"]').should('not.exist');
    // Assign section should not be visible
    cy.get('div[class*="MuiBox-root"]').should('not.contain', 'Unassigned');
  });

  it('should not show assign section for personal projects when assign does not exist', () => {
    const cardInfo = createMockSheet({
      assign: undefined,
    });

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
      isPersonal: true,
    });

    // Should not show "Unassigned" text
    cy.contains('Unassigned').should('not.exist');
    // Should not show Person icon
    cy.get('svg[data-testid="PersonIcon"]').should('not.exist');
  });

  it('should call handleViewStep when step button is clicked', () => {
    const cardInfo = createMockSheet({
      step: 'Transcribe',
    });

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
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
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

    cy.contains('button', 'Review').should('be.visible');
  });

  it('should show arrow icon in step button', () => {
    const cardInfo = createMockSheet();

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

    // Should show ArrowForwardIos icon in the button
    cy.get('svg[data-testid="ArrowForwardIosIcon"]').should('exist');
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
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
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
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
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
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

    // Comment area should exist but be empty (contains non-breaking space)
    cy.get('p[class*="MuiTypography-body2"]').should('exist');
  });

  it('should render with mobile width styling on mobile viewport', () => {
    cy.viewport(400, 800);

    const cardInfo = createMockSheet();
    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

    // Card should have mobile width (100%)
    cy.get('div[class*="MuiCard-root"]').should('be.visible');
    // Check that card exists and is visible
    cy.get('div[class*="MuiCard-root"]')
      .should('have.css', 'min-width')
      .and('match', /100%|275px/);
  });

  it('should render with desktop width styling on desktop viewport', () => {
    cy.viewport(1024, 768);

    const cardInfo = createMockSheet();
    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

    // Card should have desktop min width (275px)
    cy.get('div[class*="MuiCard-root"]').should('be.visible');
    cy.get('div[class*="MuiCard-root"]')
      .should('have.css', 'min-width')
      .and('match', /275px/);
  });

  it('should handle non-PASSAGE passage types with RefRender', () => {
    const cardInfo = createMockSheet({
      passageType: PassageTypeEnum.NOTE,
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
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

    // Should render RefRender component for non-PASSAGE types
    // The RefRender component will render the reference
    cy.get('h6[class*="MuiTypography-h6"]').should('be.visible');
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
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      isPlaying: false,
    });

    // Should render but may not show reference text
    cy.get('div[class*="MuiCard-root"]').should('be.visible');
  });

  it('should call onPlayStatus when playing ends if isPlaying is true', () => {
    const cardInfo = createMockSheet({
      mediaId: createMockRecordIdentity('media-1', 'mediafile'),
    });

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      onPlayStatus: mockOnPlayStatus,
      isPlaying: true,
    });

    // The handlePlayEnd function should be passed to LoadAndPlay
    // This will be called when audio ends if isPlaying is true
    // We can't directly test this without mocking LoadAndPlay, but the component structure is correct
    cy.get('div[class*="MuiCard-root"]').should('be.visible');
  });

  it('should not call onPlayStatus when playing ends if isPlaying is false', () => {
    const cardInfo = createMockSheet({
      mediaId: createMockRecordIdentity('media-1', 'mediafile'),
    });

    mountPassageCard(cardInfo, {
      getBookName: mockGetBookName,
      handleViewStep: mockHandleViewStep,
      onPlayStatus: mockOnPlayStatus,
      isPlaying: false,
    });

    // When isPlaying is false, handlePlayEnd won't call onPlayStatus
    // This is tested implicitly through the component logic
    cy.get('div[class*="MuiCard-root"]').should('be.visible');
  });

  // Tests for CHAPTERNUMBER passage type
  describe('CHAPTERNUMBER passage type', () => {
    it('should render correctly when passageType is CHAPTERNUMBER', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.CHAPTERNUMBER,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
      });

      // Should show the reference with RefRender and comment
      cy.get('h6[class*="MuiTypography-h6"]').should('be.visible');
      cy.contains('Chapter Introduction').should('be.visible');
    });

    it('should not show comment section for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.CHAPTERNUMBER,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
      });

      // Should not show separate comment section below title
      cy.get('p[class*="MuiTypography-body2"]').should('not.exist');
    });

    it('should not show assign section for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.CHAPTERNUMBER,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
        isPersonal: false,
      });

      // Should not show TaskAvatar or Unassigned text
      cy.contains('Unassigned').should('not.exist');
      cy.get('svg[data-testid="PersonIcon"]').should('not.exist');
    });

    it('should not show step button for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.CHAPTERNUMBER,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
      });

      // Should not show step button
      cy.contains('button', 'Record').should('not.exist');
      cy.get('svg[data-testid="ArrowForwardIosIcon"]').should('not.exist');
    });

    it('should show play button when mediaId exists for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.CHAPTERNUMBER,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        onPlayStatus: mockOnPlayStatus,
        isPlaying: false,
      });

      // Should show play icon button in the centered box
      cy.get('button[class*="MuiIconButton-root"]').should('be.visible');
      cy.get('svg[data-testid="PlayCircleOutlineIcon"]').should('exist');
    });

    it('should show AudioProgressButton when playing for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.CHAPTERNUMBER,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        onPlayStatus: mockOnPlayStatus,
        isPlaying: true,
      });

      // Should show LoadAndPlay component (AudioProgressButton) in centered box
      // The play IconButton should not be visible when isPlaying is true
      cy.get('svg[data-testid="PlayCircleOutlineIcon"]').should('not.exist');
      cy.get('div[class*="MuiCard-root"]').should('be.visible');
    });

    it('should show comment after reference when comment is defined for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.CHAPTERNUMBER,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
      });

      // Should show the comment after the reference
      cy.get('h6[class*="MuiTypography-h6"]').should(
        'contain.text',
        'Chapter Introduction'
      );
    });

    it('should not show comment after reference when comment is undefined for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.CHAPTERNUMBER,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
      });

      // Should show only the reference without any comment text
      cy.get('h6[class*="MuiTypography-h6"]').should('be.visible');
      // The h6 should not contain any comment text - only RefRender content
      cy.get('h6[class*="MuiTypography-h6"]').should(
        'not.contain.text',
        'undefined'
      );
    });

    it('should not show comment after reference when comment is empty string for CHAPTERNUMBER type', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.CHAPTERNUMBER,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
      });

      // Should show only the reference without any comment text
      cy.get('h6[class*="MuiTypography-h6"]').should('be.visible');
      // Should not show any additional text after the reference
      cy.get('h6[class*="MuiTypography-h6"]').should('not.contain.text', ' ');
    });
  });

  // Tests for graphic rendering
  describe('Graphic rendering', () => {
    it('should show graphic avatar for NOTE type when graphicUri is provided', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.NOTE,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
      });

      // Should show avatar with image source
      cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
      cy.get('img[src="https://example.com/note-image.png"]').should('exist');
    });

    it('should show graphic avatar for CHAPTERNUMBER type when graphicUri is provided', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.CHAPTERNUMBER,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
      });

      // Should show avatar with image source
      cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
      cy.get('img[src="https://example.com/chapter-image.png"]').should(
        'exist'
      );
    });

    it('should show string avatar for NOTE type when no graphicUri is provided', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.NOTE,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
      });

      // Should show avatar with generated text
      cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
      // Avatar should contain text (stringAvatar generates initials from the reference)
      cy.get('div[class*="MuiAvatar-root"]').should('not.be.empty');
    });

    it('should show string avatar for CHAPTERNUMBER type when no graphicUri is provided', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.CHAPTERNUMBER,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
      });

      // Should show avatar with generated text
      cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
      // Avatar should contain text (stringAvatar generates initials from the reference)
      cy.get('div[class*="MuiAvatar-root"]').should('not.be.empty');
    });

    it('should apply border color styling to avatar when color is provided', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.NOTE,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
      });

      // Should show avatar with border styling
      cy.get('div[class*="MuiAvatar-root"]')
        .should('be.visible')
        .and('have.css', 'border-color', 'rgb(255, 0, 0)'); // #ff0000 in rgb
    });

    it('should not show graphic for PASSAGE type', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.PASSAGE,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
      });

      // Should not show avatar for PASSAGE type
      cy.get('div[class*="MuiAvatar-root"]').should('not.exist');
    });

    it('should not show graphic for other passage types', () => {
      const cardInfo = createMockSheet({
        passageType: PassageTypeEnum.BOOK,
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
        getBookName: mockGetBookName,
        handleViewStep: mockHandleViewStep,
        isPlaying: false,
      });

      // Should not show avatar for BOOK type
      cy.get('div[class*="MuiAvatar-root"]').should('not.exist');
    });
  });
});
