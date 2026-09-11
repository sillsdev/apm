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
import {
  UnsavedContext,
  ICtxState as UnsavedState,
} from '../../context/UnsavedContext';
import { ArtifactCategoryType } from '../../crud';
import localizationReducer from '../../store/localization/reducers';
import CategoryListEdit from './CategoryListEdit';

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
      liveQuery: (queryFn: (q: ReturnType<typeof createMockQueryBuilder>) => unknown) => ({
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

const discussionCategories: RecordsByKey = {
  [`organization:${TEAM_ID}`]: {
    id: TEAM_ID,
    type: 'organization',
    attributes: { name: 'Test Team', slug: 'test-team' },
  },
  'artifactcategory:cat1': {
    id: 'cat1',
    type: 'artifactcategory',
    attributes: {
      categoryname: 'Category 1',
      discussion: true,
      resource: false,
      note: false,
      color: '',
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
    attributes: {
      categoryname: 'Category 2',
      discussion: true,
      resource: false,
      note: false,
      color: '',
      specialuse: '',
    },
    relationships: {
      organization: { data: { type: 'organization', id: TEAM_ID } },
      titleMediafile: { data: null },
    },
  },
};

const noteCategories: RecordsByKey = {
  [`organization:${TEAM_ID}`]: {
    id: TEAM_ID,
    type: 'organization',
    attributes: { name: 'Test Team', slug: 'test-team' },
  },
  'artifactcategory:cat1': {
    id: 'cat1',
    type: 'artifactcategory',
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
};

const mockCategoryStrings = new LocalizedStrings({
  en: {
    builtIn: 'System Categories',
    discussion: 'Discussion',
    close: 'Close',
    duplicate: 'Duplicate Category',
    discussions: 'discussion(s)',
    ignoreInvalid: "Ignoring invalid category change '{0}'.",
    inUseBy: 'In use by {0} {1}',
    note: 'Audio Note',
    chapternumber: 'Chapter Number',
    general: 'General Note',
    introPara: 'Introductory Paragraph',
    resource: 'Resource',
    notes: 'audio note(s)',
    resources: 'resource(s)',
    apply: 'Apply',
    edit: 'Edit',
  },
});

const mockSharedStrings = new LocalizedStrings({
  en: {
    cancel: 'Cancel',
    save: 'Save',
    saving: 'Saving...',
    uploadSuccess: 'Upload Successful',
  },
});

const mockSelectArtifactCategoryStrings = new LocalizedStrings({
  en: {
    addNewCategory: 'Add New Category',
    artifactCategory: 'Category',
    duplicateCategory: 'Category already exists.',
    newArtifactCategory: 'New Category',
    scriptureHighlight: '',
  },
});

const mockMediaTitleStrings = new LocalizedStrings({
  en: {
    cancel: 'Cancel Recording',
    playPause: 'Play / Pause',
    record: 'Record',
    recordOrUpload: 'Record or Upload',
    recording: 'Recording...',
    save: 'Save Recording',
    saving: 'Saving...',
    provideAudio: "Provide audio for '{0}'",
    unsavedChanges: 'Please cancel, save or upload.',
    upload: 'Upload',
    uploadFailed: 'Upload Failed!',
    uploadFailStatus: '{0} Upload Failed!',
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
    category: mockCategoryStrings,
    shared: mockSharedStrings,
    selectArtifactCategory: mockSelectArtifactCategoryStrings,
    mediaTitle: mockMediaTitleStrings,
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

const mockUnsavedState = {
  checkSavedFn: (method: () => void) => method(),
  t: {} as any,
  handleSaveConfirmed: () => {},
  handleSaveRefused: () => {},
  toolChanged: () => {},
  startSave: () => {},
  startClear: () => {},
  saveCompleted: () => {},
  clearCompleted: () => {},
  waitForSave: async () => {},
  forceClearPending: () => {},
  anySaving: () => false as const,
  saveRequested: () => false as const,
  clearRequested: () => false as const,
  isChanged: () => false as const,
  toolsChanged: {},
} as UnsavedState;

describe('CategoryListEdit (TT-7627)', () => {
  let memory: Memory;
  let onClose: ReturnType<typeof cy.stub>;

  const createInitialState = (overrides = {}) => ({
    coordinator: {
      getSource: () => undefined,
    } as unknown as Coordinator,
    errorReporter: bugsnagClient,
    fingerprint: 'test-fingerprint',
    memory,
    latestVersion: '',
    loadComplete: true,
    offlineOnly: true,
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
    // offlineOnly loads local artifact categories; offline=false so TT-7180
    // does not disable Note graphic controls in exclusive-edit tests.
    offline: false,
    mobileView: false,
    addStoryOrPassage: false,
    ...overrides,
  });

  const mountList = (
    type: ArtifactCategoryType = ArtifactCategoryType.Discussion,
    records: RecordsByKey = discussionCategories
  ) => {
    memory = createMockMemory(records);
    onClose = cy.stub().as('onClose');
    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider init={createInitialState()}>
          <DataProvider dataStore={memory}>
            <SnackBarProvider>
              <UnsavedContext.Provider
                value={{ state: mockUnsavedState, setState: cy.stub() }}
              >
                <CategoryListEdit
                  type={type}
                  teamId={TEAM_ID}
                  onClose={onClose}
                />
              </UnsavedContext.Provider>
            </SnackBarProvider>
          </DataProvider>
        </GlobalProvider>
      </Provider>
    );
  };

  /**
   * Exclusive edit: Apply one category, then another, then dialog Save —
   * both renames persist without closing between Applies (TT-7627).
   */
  it('applies sequential category edits then saves both', () => {
    mountList();

    cy.get('#cat-edit-cat1', { timeout: 10000 }).should('be.visible').click();
    cy.get('#cat1adornment')
      .should('not.be.disabled')
      .clear()
      .type('Test Category One Edit');
    cy.get('#cat-apply-cat1').click();
    cy.get('#cat1adornment').should('have.value', 'Test Category One Edit');

    cy.get('#cat-edit-cat2').should('not.be.disabled').click();
    cy.get('#cat2adornment')
      .should('not.be.disabled')
      .clear()
      .type('Test Category Two Edit');
    cy.get('#cat-apply-cat2').click();
    cy.get('#cat2adornment').should('have.value', 'Test Category Two Edit');
    cy.get('#cat1adornment').should('have.value', 'Test Category One Edit');

    cy.get('#catSave').should('not.be.disabled').click();
    cy.get('@onClose').should('have.been.called');
    // Discriminating assertion (Copilot r3970692654): a bare
    // `memoryUpdate.called` still passes if one staged rename is dropped,
    // because Save always calls memory.update for the delete batch.
    cy.get('@memoryUpdate').should((stub) => {
      const namesById = new Map<string, string>();
      for (const call of stub.getCalls()) {
        const ops = call.args[0];
        if (!Array.isArray(ops)) continue;
        for (const op of ops) {
          if (op?.op !== 'updateRecord') continue;
          const rec = op.record;
          if (rec?.type !== 'artifactcategory' || !rec?.id) continue;
          const name = rec.attributes?.categoryname;
          if (typeof name === 'string') namesById.set(rec.id, name);
        }
      }
      expect(namesById.get('cat1'), 'cat1 rename persisted').to.eq(
        'Test Category One Edit'
      );
      expect(namesById.get('cat2'), 'cat2 rename persisted').to.eq(
        'Test Category Two Edit'
      );
    });
  });

  it('cancels an in-progress edit and allows editing another category', () => {
    mountList();

    cy.get('#cat-edit-cat1', { timeout: 10000 }).click();
    cy.get('#cat1adornment').clear().type('Changed Then Cancelled');
    cy.get('#cat-cancel-edit-cat1').click();
    cy.get('#cat1adornment').should('have.value', 'Category 1');
    cy.get('#cat-edit-cat2').should('not.be.disabled').click();
    cy.get('#cat2adornment').should('not.be.disabled');
  });

  it('disables editing a second category while one is being edited', () => {
    mountList();

    cy.get('#cat-edit-cat1', { timeout: 10000 }).click();
    cy.get('#cat-edit-cat2').should('be.disabled');
    cy.get('#cat2adornment').should('be.disabled');
    cy.get('#catSave').should('be.disabled');
  });

  /**
   * Copilot review: deleted categories must not block renaming another
   * category to the deleted name (Apply / Save duplicate check).
   */
  it('allows renaming to a deleted category name', () => {
    mountList();

    cy.get('#cat-delete-cat2', { timeout: 10000 }).should('not.be.disabled').click();
    cy.get('#cat2adornment').should('not.exist');

    cy.get('#cat-edit-cat1').click();
    cy.get('#cat1adornment').clear().type('Category 2');
    cy.get('#cat-apply-cat1').click();

    // Apply succeeded: leave edit mode and keep the reused name
    cy.get('#cat-apply-cat1').should('not.exist');
    cy.get('#cat-edit-cat1').should('be.visible');
    cy.get('#cat1adornment').should('have.value', 'Category 2');
    cy.get('#catSave').should('not.be.disabled').click();
    cy.get('@onClose').should('have.been.called');
  });

  /**
   * Copilot review: Note color/graphic controls must honor exclusive-edit
   * `disabled` (not only MediaTitle).
   */
  it('disables Note color and graphic controls on non-editing rows', () => {
    mountList(ArtifactCategoryType.Note, noteCategories);

    cy.get('#cat-color-cat1', { timeout: 10000 }).should('be.disabled');
    cy.get('#cat-graphic-cat1').should('be.disabled');

    cy.get('#cat-edit-cat1').click();
    cy.get('#cat-color-cat1').should('not.be.disabled');
    cy.get('#cat-graphic-cat1').should('not.be.disabled');
    cy.get('#cat-color-cat2').should('be.disabled');
    cy.get('#cat-graphic-cat2').should('be.disabled');
  });

  /**
   * Copilot r3970692716: Cancel must discard staged graphics — picker finish
   * must not call saveGraphicRecord until Apply (otherwise Cancel leaves the
   * Orbit graphic persisted).
   */
  it('discards a staged Note graphic when the row edit is cancelled', () => {
    mountList(ArtifactCategoryType.Note, noteCategories);

    cy.get('#cat-edit-cat1', { timeout: 10000 }).click();
    cy.get('#cat-graphic-cat1').should('be.visible');
    // Icon button (no avatar) before staging
    cy.get('#cat-graphic-cat1').should('match', 'button');

    cy.get('#cat-stage-graphic-cat1').click({ force: true });
    cy.get('#cat-graphic-cat1').should('match', 'div'); // Avatar after stage

    cy.get('#cat-cancel-edit-cat1').click();
    cy.get('#cat-edit-cat1').should('be.visible');
    // Preview discarded; no Orbit graphic existed, so back to icon button
    cy.get('#cat-graphic-cat1').should('match', 'button');
  });
});
