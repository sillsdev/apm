import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import BurritoUploadDialog from './BurritoUpload';
import localizationReducer from '../store/localization/reducers';
import { GlobalProvider, GlobalState } from '../context/GlobalContext';
import bugsnagClient from '../auth/bugsnagClient';
import Memory from '@orbit/memory';
import Coordinator from '@orbit/coordinator';

describe('BurritoUploadDialog', () => {
  const mockMemory = {
    cache: { query: () => [], liveQuery: () => () => {} },
    update: () => {},
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

  const mountDialog = (
    props: React.ComponentProps<typeof BurritoUploadDialog>
  ) => {
    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider init={createInitialState()}>
          <BurritoUploadDialog {...props} />
        </GlobalProvider>
      </Provider>
    );
  };

  beforeEach(() => {
    cy.viewport(800, 600);
  });

  it('should render dialog with correct title', () => {
    const onSubmit = cy.stub();
    const onCancel = cy.stub();

    mountDialog({
      open: true,
      onSubmit,
      onCancel,
    });

    cy.get('[data-cy="burrito-upload-dialog-title"]').should(
      'contain.text',
      'Import Scripture Burrito'
    );
  });

  it('should show browse buttons', () => {
    const onSubmit = cy.stub();
    const onCancel = cy.stub();

    mountDialog({
      open: true,
      onSubmit,
      onCancel,
    });

    cy.get('[data-cy="burrito-upload-browse-directory"]').should('be.visible');
    cy.get('[data-cy="burrito-upload-browse-zip"]').should('be.visible');
  });

  it('should have cancel and import buttons', () => {
    const onSubmit = cy.stub();
    const onCancel = cy.stub();

    mountDialog({
      open: true,
      onSubmit,
      onCancel,
    });

    cy.get('[data-cy="burrito-upload-cancel"]').should('be.visible');
    cy.get('[data-cy="burrito-upload-import"]').should('be.visible');
  });

  it('should disable import button when nothing selected', () => {
    const onSubmit = cy.stub();
    const onCancel = cy.stub();

    mountDialog({
      open: true,
      onSubmit,
      onCancel,
    });

    cy.get('[data-cy="burrito-upload-import"]').should('be.disabled');
  });

  it('should render with custom title', () => {
    const onSubmit = cy.stub();
    const onCancel = cy.stub();

    mountDialog({
      open: true,
      onSubmit,
      onCancel,
      title: 'Custom Title',
    });

    cy.get('[data-cy="burrito-upload-dialog-title"]').should(
      'contain.text',
      'Custom Title'
    );
  });

  it('should not render when open is false', () => {
    const onSubmit = cy.stub();
    const onCancel = cy.stub();

    mountDialog({
      open: false,
      onSubmit,
      onCancel,
    });

    cy.get('[data-cy="burrito-upload-dialog-title"]').should('not.exist');
  });
});
