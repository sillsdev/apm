/**
 * TT-7656: Note Details category picker must show cached categories immediately
 * even when the Orbit remote request queue is busy (mid-work-session).
 */
import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import LocalizedStrings from 'react-localization';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../auth/bugsnagClient';
import { GlobalProvider } from '../../context/GlobalContext';
import DataProvider from '../../hoc/DataProvider';
import SnackBarProvider from '../../hoc/SnackBar';
import { ArtifactCategoryType } from '../../crud';
import localizationReducer from '../../store/localization/reducers';
import SelectArtifactCategory from './SelectArtifactCategory';

const TEAM_ID = 'team-1';

type RecordsByKey = Record<string, any>;

const createMockQueryBuilder = (records: RecordsByKey) => ({
  findRecords: (type: string) => {
    const list = Object.entries(records)
      .filter(([key]) => key.startsWith(`${type}:`))
      .map(([, rec]) => rec);
    return Object.assign([...list], {
      filter: (f: { attribute: string; value: unknown }) =>
        list.filter((r) => r.attributes?.[f.attribute] === f.value),
    });
  },
  findRecord: ({ type, id }: { type: string; id: string }) =>
    records[`${type}:${id}`],
});

const createMockMemory = (records: RecordsByKey = {}): Memory => {
  const runQuery = (
    queryFn: (q: ReturnType<typeof createMockQueryBuilder>) => unknown
  ) => queryFn(createMockQueryBuilder(records));
  return {
    cache: {
      query: runQuery,
      liveQuery: (
        queryFn: (q: ReturnType<typeof createMockQueryBuilder>) => unknown
      ) => ({
        subscribe: () => () => {},
        query: () => runQuery(queryFn),
      }),
    },
    query: async (
      queryFn: (q: ReturnType<typeof createMockQueryBuilder>) => unknown
    ) => runQuery(queryFn),
    update: cy.stub().as('memoryUpdate').resolves(),
    keyMap: { idToKey: () => undefined, keyToId: () => undefined },
  } as unknown as Memory;
};

/** Note categories with remoteIds so they survive the online remoteId filter. */
const noteCategories: RecordsByKey = {
  [`organization:${TEAM_ID}`]: {
    id: TEAM_ID,
    type: 'organization',
    attributes: { name: 'Test Team', slug: 'test-team' },
  },
  'artifactcategory:cat1': {
    id: 'cat1',
    type: 'artifactcategory',
    keys: { remoteId: '101' },
    attributes: {
      categoryname: 'Category 1',
      discussion: false,
      resource: false,
      note: true,
      color: '#ff0000',
      specialuse: '',
    },
    relationships: {
      organization: { data: { type: 'organization', id: TEAM_ID } },
      titleMediafile: { data: null },
    },
  },
  'artifactcategory:cat2': {
    id: 'cat2',
    type: 'artifactcategory',
    keys: { remoteId: '102' },
    attributes: {
      categoryname: 'Category 2',
      discussion: false,
      resource: false,
      note: true,
      color: '#00ff00',
      specialuse: '',
    },
    relationships: {
      organization: { data: { type: 'organization', id: TEAM_ID } },
      titleMediafile: { data: null },
    },
  },
  'artifactcategory:chapter': {
    id: 'chapter',
    type: 'artifactcategory',
    keys: { remoteId: '103' },
    attributes: {
      categoryname: 'chapter',
      discussion: false,
      resource: false,
      note: true,
      color: '',
      specialuse: 'chapter',
    },
    relationships: {
      organization: { data: { type: 'organization', id: TEAM_ID } },
      titleMediafile: { data: null },
    },
  },
};

const mockSelectArtifactCategoryStrings = new LocalizedStrings({
  en: {
    addNewCategory: 'Add New Category',
    artifactCategory: 'Category',
    duplicateCategory: 'Category already exists.',
    newArtifactCategory: 'New Category',
    scriptureHighlight: '',
  },
});

const mockArtifactCategoryStrings = new LocalizedStrings({
  en: {
    activity: 'Activity',
    biblestory: 'Bible Story',
    bookintro: 'Book Introduction',
    chapter: 'Chapter Number',
    scripture: 'Scripture',
    translationresource: 'Translation Resource',
    uncategorized: 'Uncategorized',
    retelling: 'Community Test Retell',
    grammar: 'Grammar',
    graphic: 'Graphic',
    qanda: 'Question and Answer',
    title: 'Title',
  },
});

const mockStringsReducer = () => {
  const initialState = localizationReducer(undefined, { type: '@@INIT' });
  return {
    ...initialState,
    loaded: true,
    lang: 'en',
    selectArtifactCategory: mockSelectArtifactCategoryStrings,
    artifactCategory: mockArtifactCategoryStrings,
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

describe('SelectArtifactCategory (TT-7656)', () => {
  let memory: Memory;
  /** Mutable queue length so a late drain can be simulated. */
  let queueLength = 3;

  const createInitialState = (overrides = {}) => ({
    coordinator: {
      getSource: () => ({
        requestQueue: {
          get length() {
            return queueLength;
          },
        },
      }),
    } as unknown as Coordinator,
    errorReporter: bugsnagClient,
    fingerprint: 'test-fingerprint',
    memory,
    latestVersion: '',
    loadComplete: true,
    // Online mode: categories must have remoteId (fixtures do).
    offlineOnly: false,
    organization: TEAM_ID,
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

  beforeEach(() => {
    queueLength = 3;
    // Without this, useCheckOnline fails, flips connected=false, and
    // waitForIt short-circuits — false green on unfixed code.
    cy.intercept('GET', '**/api/AmIOnline/', { statusCode: 200, body: {} });
  });

  const mountSelect = () => {
    memory = createMockMemory(noteCategories);
    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider init={createInitialState()}>
          <DataProvider dataStore={memory}>
            <SnackBarProvider>
              <SelectArtifactCategory
                type={ArtifactCategoryType.Note}
                initCategory="cat1"
                required={false}
                allowNew
              />
            </SnackBarProvider>
          </DataProvider>
        </GlobalProvider>
      </Provider>
    );
  };

  it('shows note categories immediately while the remote queue is busy', () => {
    mountSelect();

    // Discriminating: must appear well under a 1s waitForIt poll.
    cy.get('#artifact-category', { timeout: 800 }).should(
      'have.value',
      'Category 1'
    );
    cy.get('#artifact-category').click();
    cy.contains('li', 'Category 1').should('be.visible');
    cy.contains('li', 'Category 2').should('be.visible');
    // specialuse categories are filtered out of the dropdown
    cy.contains('li', 'Chapter Number').should('not.exist');
  });

  it('keeps what the user types when the queue drains late', () => {
    cy.clock();
    mountSelect();

    // With the fix, categories load from cache before any tick — field is ready.
    // With the bug, getArtifactCategorys is still blocked on waitForRemoteQueue.
    cy.tick(0);
    cy.get('#artifact-category', { timeout: 800 }).should('exist');

    // Type a new category name while (on unfixed code) load is still pending.
    cy.get('#artifact-category').clear().type('My New Category');

    // Simulate a late queue drain after a waitForIt poll interval.
    queueLength = 0;
    cy.tick(1000);

    // Typed text must survive — late setCategoryId(init) + setInputVal(currentName)
    // used to wipe it when categories finally arrived.
    cy.get('#artifact-category').should('have.value', 'My New Category');
  });
});
