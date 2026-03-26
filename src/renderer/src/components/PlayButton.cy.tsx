import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { PlayButton } from './PlayButton';
import localizationReducer from '../store/localization/reducers';
import { GlobalProvider, GlobalState } from '../context/GlobalContext';
import bugsnagClient from '../auth/bugsnagClient';
import Memory from '@orbit/memory';
import Coordinator from '@orbit/coordinator';

describe('PlayButton', () => {
  let mockOnPlayStatus: ReturnType<typeof cy.stub>;
  let mockOnPlayEnd: ReturnType<typeof cy.stub>;

  const mockMemory = {
    cache: { query: () => [], liveQuery: () => () => {} },
    update: () => {},
    // `useFetchMediaUrl` uses `remoteId()` / `remoteIdGuid()`, which call
    // `keyMap.idToKey` and `keyMap.keyToId` respectively. Provide minimal
    // implementations to avoid crashes in CT.
    keyMap: {
      idToKey: (_table: string, _attr: string, localId: string) => localId,
      keyToId: (_table: string, _attr: string, remoteId: string) =>
        remoteId,
    },
  } as unknown as Memory;

  const mockCoordinator = {
    getSource: () => mockMemory,
  } as unknown as Coordinator;

  const mockStringsReducer = () => {
    const initialState = localizationReducer(undefined, { type: '@@INIT' });
    return {
      ...initialState,
      loaded: true,
      lang: 'en',
    };
  };

  const mockStore = createStore(
    combineReducers({
      strings: mockStringsReducer,
    })
  );

  const createInitialState = (): GlobalState => ({
    coordinator: mockCoordinator,
    errorReporter: bugsnagClient,
    fingerprint: 'test-fingerprint',
    memory: mockMemory,
    lang: 'en',
    latestVersion: '',
    loadComplete: false,
    offlineOnly: false,
    organization: 'test-org',
    releaseDate: '',
    user: 'test-user',
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
  });

  const mountPlayButton = (props: React.ComponentProps<typeof PlayButton>) => {
    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider init={createInitialState()}>
          <PlayButton {...props} />
        </GlobalProvider>
      </Provider>
    );
  };

  beforeEach(() => {
    mockOnPlayStatus = cy.stub().as('onPlayStatus');
    mockOnPlayEnd = cy.stub().as('onPlayEnd');
  });

  it('should render nothing when mediaId is not provided', () => {
    mountPlayButton({
      isPlaying: false,
      onPlayStatus: mockOnPlayStatus,
      onPlayEnd: mockOnPlayEnd,
    });

    cy.get('[data-testid="play-button"]').should('not.exist');
    cy.get('button').should('not.exist');
  });

  it('should render play button when mediaId is provided and not playing', () => {
    mountPlayButton({
      mediaId: 'test-media-id',
      isPlaying: false,
      onPlayStatus: mockOnPlayStatus,
      onPlayEnd: mockOnPlayEnd,
    });

    cy.get('[data-testid="play-button"]')
      .should('be.visible')
      .find('svg[data-testid="PlayCircleOutlineIcon"]')
      .should('be.visible');
  });

  it('should call onPlayStatus when play button is clicked', () => {
    mountPlayButton({
      mediaId: 'test-media-id',
      isPlaying: false,
      onPlayStatus: mockOnPlayStatus,
      onPlayEnd: mockOnPlayEnd,
    });

    cy.get('[data-testid="play-button"]').click();
    cy.wrap(mockOnPlayStatus).should('have.been.called');
  });

  it('should render LoadAndPlay component when playing', () => {
    mountPlayButton({
      mediaId: 'test-media-id',
      isPlaying: true,
      onPlayStatus: mockOnPlayStatus,
      onPlayEnd: mockOnPlayEnd,
    });

    cy.get('svg[data-testid="PlayCircleOutlineIcon"]').should('not.exist');
  });

  it('should apply custom styling when sx prop is provided', () => {
    const customSx = { width: 60, height: 60 };

    mountPlayButton({
      mediaId: 'test-media-id',
      isPlaying: false,
      onPlayStatus: mockOnPlayStatus,
      onPlayEnd: mockOnPlayEnd,
      sx: customSx,
    });

    cy.get('[data-testid="play-button"]').should('be.visible');
  });

  it('should handle missing onPlayStatus callback gracefully', () => {
    mountPlayButton({
      mediaId: 'test-media-id',
      isPlaying: false,
      onPlayEnd: mockOnPlayEnd,
    });

    cy.get('[data-testid="play-button"]').should('be.visible');
    cy.get('[data-testid="play-button"]').click();
  });

  it('should render with default sx values', () => {
    mountPlayButton({
      mediaId: 'test-media-id',
      isPlaying: false,
      onPlayStatus: mockOnPlayStatus,
      onPlayEnd: mockOnPlayEnd,
    });

    cy.get('[data-testid="play-button"]').should('be.visible');
  });

  describe('Different states', () => {
    const testStates = [
      { isPlaying: false, description: 'not playing' },
      { isPlaying: true, description: 'playing' },
    ];

    testStates.forEach(({ isPlaying, description }) => {
      it(`should handle ${description} state correctly`, () => {
        mountPlayButton({
          mediaId: 'test-media-id',
          isPlaying,
          onPlayStatus: mockOnPlayStatus,
          onPlayEnd: mockOnPlayEnd,
        });

        if (isPlaying) {
          cy.get('svg[data-testid="PlayCircleOutlineIcon"]').should(
            'not.exist'
          );
        } else {
          cy.get('[data-testid="play-button"]').should('be.visible');
          cy.get('svg[data-testid="PlayCircleOutlineIcon"]').should(
            'be.visible'
          );
        }
      });
    });
  });
});
