import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import FilterContent from './FilterContent';
import { FilterData } from './FilterContent';
import localizationReducer from '../store/localization/reducers';
import { GlobalProvider, GlobalState } from '../context/GlobalContext';
import bugsnagClient from '../auth/bugsnagClient';
import Memory from '@orbit/memory';
import Coordinator from '@orbit/coordinator';

describe('FilterContent', () => {
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

  const mockFilterData: FilterData = {
    label: 'Test Project',
    books: [
      {
        id: 'MAT',
        label: 'Matthew',
        chapters: ['1', '2', '3'],
        burritos: ['audioTranslation', 'textTranslation'],
      },
      {
        id: 'LUK',
        label: 'Luke',
        chapters: ['1', '2'],
        burritos: ['audioTranslation'],
      },
    ],
  };

  const mountFilter = (props: React.ComponentProps<typeof FilterContent>) => {
    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider init={createInitialState()}>
          <FilterContent {...props} />
        </GlobalProvider>
      </Provider>
    );
  };

  beforeEach(() => {
    cy.viewport(800, 600);
  });

  it('should render dialog with project label', () => {
    const onSubmit = cy.stub();
    const onVisible = cy.stub();

    mountFilter({
      filterVisible: true,
      onFilterVisible: onVisible,
      filterSubmit: onSubmit,
      filterData: mockFilterData,
    });

    cy.get('#bigDlg').should('contain.text', 'Scripture Burrito: Test Project');
  });

  it('should show instructions text', () => {
    const onSubmit = cy.stub();
    const onVisible = cy.stub();

    mountFilter({
      filterVisible: true,
      onFilterVisible: onVisible,
      filterSubmit: onSubmit,
      filterData: mockFilterData,
    });

    cy.contains(
      'Please select the information you want to import into your team.'
    ).should('be.visible');
  });

  it('should render tree with books', () => {
    const onSubmit = cy.stub();
    const onVisible = cy.stub();

    mountFilter({
      filterVisible: true,
      onFilterVisible: onVisible,
      filterSubmit: onSubmit,
      filterData: mockFilterData,
    });

    // Multiple books are grouped under "All Books"; expand to reveal labels.
    cy.contains('All Books').should('be.visible').click();
    cy.contains('Matthew').should('be.visible');
    cy.contains('Luke').should('be.visible');
  });

  it('should have upload button', () => {
    const onSubmit = cy.stub();
    const onVisible = cy.stub();

    mountFilter({
      filterVisible: true,
      onFilterVisible: onVisible,
      filterSubmit: onSubmit,
      filterData: mockFilterData,
    });

    cy.get('#filterSave').should('be.visible').and('contain.text', 'Upload');
  });

  it('should not render when visible is false', () => {
    const onSubmit = cy.stub();
    const onVisible = cy.stub();

    mountFilter({
      filterVisible: false,
      onFilterVisible: onVisible,
      filterSubmit: onSubmit,
      filterData: mockFilterData,
    });

    cy.get('#bigDlg').should('not.exist');
  });

  it('should handle empty books array', () => {
    const emptyFilterData: FilterData = {
      label: 'Empty Project',
      books: [],
    };

    const onSubmit = cy.stub();
    const onVisible = cy.stub();

    mountFilter({
      filterVisible: true,
      onFilterVisible: onVisible,
      filterSubmit: onSubmit,
      filterData: emptyFilterData,
    });

    cy.get('#bigDlg').should(
      'contain.text',
      'Scripture Burrito: Empty Project'
    );
  });
});
