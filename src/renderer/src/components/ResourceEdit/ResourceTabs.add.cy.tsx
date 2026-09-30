/**
 * TT-7730: Adding a note (title + new category) must show Saving and switch to
 * References without waiting for the Orbit remote request queue to drain.
 */
import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import { RecordOperation } from '@orbit/records';
import bugsnagClient from '../../auth/bugsnagClient';
import { GlobalProvider } from '../../context/GlobalContext';
import { UnsavedContext } from '../../context/UnsavedContext';
import DataProvider from '../../hoc/DataProvider';
import SnackBarProvider from '../../hoc/SnackBar';
import { PassageTypeEnum, RoleNames, IwsKind, SheetLevel } from '../../model';
import localizationReducer from '../../store/localization/reducers';
import { schema } from '../../schema';
import ResourceTabs from './ResourceTabs';

const TEAM_ID = 'team-1';
const PASSAGE_ID = 'p1';

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

/** Apply local Orbit ops so the shared resource exists before the remote queue drains. */
const applyOps = (records: RecordsByKey, ops: RecordOperation[]) => {
  for (const op of ops) {
    if (op.op === 'addRecord' || op.op === 'updateRecord') {
      const rec = op.record;
      const key = `${rec.type}:${rec.id}`;
      const prior = records[key];
      records[key] = prior
        ? {
            ...prior,
            ...rec,
            attributes: { ...prior.attributes, ...rec.attributes },
            relationships: { ...prior.relationships, ...rec.relationships },
          }
        : rec;
    } else if (op.op === 'replaceRelatedRecord') {
      const key = `${op.record.type}:${op.record.id}`;
      const prior = records[key];
      if (!prior) continue;
      records[key] = {
        ...prior,
        relationships: {
          ...prior.relationships,
          [op.relationship]: { data: op.relatedRecord ?? null },
        },
      };
    }
  }
};

const createMockMemory = (records: RecordsByKey = {}): Memory => {
  const runQuery = (
    queryFn: (q: ReturnType<typeof createMockQueryBuilder>) => unknown
  ) => queryFn(createMockQueryBuilder(records));
  return {
    schema,
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
    update: (arg: unknown) => {
      if (Array.isArray(arg)) applyOps(records, arg as RecordOperation[]);
      return Promise.resolve();
    },
    keyMap: { idToKey: () => undefined, keyToId: () => undefined },
  } as unknown as Memory;
};

const notePassage: RecordsByKey = {
  [`organization:${TEAM_ID}`]: {
    id: TEAM_ID,
    type: 'organization',
    attributes: { name: 'Test Team', slug: 'test-team', defaultParams: '{}' },
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
  'artifactcategory:title': {
    id: 'title',
    type: 'artifactcategory',
    keys: { remoteId: '104' },
    attributes: {
      categoryname: 'title',
      discussion: false,
      resource: false,
      note: true,
      color: '',
      specialuse: 'title',
    },
    relationships: {
      organization: { data: { type: 'organization', id: TEAM_ID } },
      titleMediafile: { data: null },
    },
  },
  [`passage:${PASSAGE_ID}`]: {
    id: PASSAGE_ID,
    type: 'passage',
    attributes: { reference: 'NOTE' },
    relationships: {
      sharedResource: { data: null },
    },
  },
};

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
    books: () => ({}),
    orbit: () => ({}),
    upload: () => ({}),
    paratext: () => ({}),
    importexport: () => ({}),
    auth: () => ({}),
  })
);

const passage = notePassage[`passage:${PASSAGE_ID}`];

describe('ResourceTabs add note (TT-7730)', () => {
  let memory: Memory;
  /** Stays non-zero so waitForRemoteQueue cannot finish inside one 1s poll. */
  const queueLength = 3;

  const createInitialState = () => ({
    coordinator: {
      getSource: () => ({
        requestQueue: { length: queueLength },
      }),
    } as unknown as Coordinator,
    errorReporter: bugsnagClient,
    fingerprint: 'test-fingerprint',
    memory,
    latestVersion: '',
    loadComplete: true,
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
    orgRole: RoleNames.Admin,
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
  });

  beforeEach(() => {
    // Without this, useCheckOnline fails, flips connected=false, and
    // waitForIt short-circuits — false green on unfixed code.
    cy.intercept('GET', '**/api/AmIOnline/', { statusCode: 200, body: {} });
  });

  const mountTabs = (
    options: {
      records?: RecordsByKey;
      /** Hang the sharedresource addRecord so a second Add click lands mid-save. */
      holdSharedResourceAdd?: () => Promise<unknown>;
    } = {}
  ) => {
    const records = options.records ?? { ...notePassage };
    memory = createMockMemory(records);
    if (options.holdSharedResourceAdd) {
      const hold = options.holdSharedResourceAdd;
      const update = memory.update.bind(memory);
      memory.update = ((arg: Parameters<Memory['update']>[0]) => {
        const ops = (Array.isArray(arg) ? arg : []) as RecordOperation[];
        const addsShared = ops.some(
          (op) => op.op === 'addRecord' && op.record.type === 'sharedresource'
        );
        const pending = update(arg);
        return addsShared ? hold().then(() => pending) : pending;
      }) as Memory['update'];
    }
    // StrictMode matches the app shell. The snack only mounts after that
    // double layout effect in dev (useMounted).
    cy.mount(
      <React.StrictMode>
        <Provider store={mockStore}>
          <GlobalProvider init={createInitialState()}>
            <DataProvider dataStore={memory}>
              <SnackBarProvider>
                <UnsavedContext.Provider
                  value={{
                    state: {
                      toolChanged: () => undefined,
                      toolsChanged: {},
                      startSave: () => undefined,
                      saveRequested: () => false,
                      saveCompleted: () => undefined,
                      clearRequested: () => false,
                      clearCompleted: () => undefined,
                    } as any,
                    setState: cy.stub(),
                  }}
                >
                  <ResourceTabs
                    passId={PASSAGE_ID}
                    hasPublishing={false}
                    ws={{
                      level: SheetLevel.Passage,
                      kind: IwsKind.Passage,
                      sectionSeq: 1,
                      passageSeq: 1,
                      passageType: PassageTypeEnum.NOTE,
                      deleted: false,
                      filtered: false,
                      published: [],
                      passage,
                    }}
                    onOpen={cy.stub()}
                    onUpdRef={cy.stub()}
                  />
                </UnsavedContext.Provider>
              </SnackBarProvider>
            </DataProvider>
          </GlobalProvider>
        </Provider>
      </React.StrictMode>
    );
  };

  it('shows Saving and selects References while the remote queue is busy', () => {
    mountTabs();

    cy.get(`#note-${PASSAGE_ID}adornment`, { timeout: 4000 }).type(
      'Morning note'
    );
    // MUI puts the TextField id on the label, not the combobox. Keywords is
    // the other combobox on this form.
    cy.contains('.MuiFormControl-root', 'Category')
      .find('input[role="combobox"]')
      .clear()
      .type('Field Note');
    cy.get('#resSave').should('not.be.disabled').click();

    // Discriminating: both must land well under a 1s waitForIt poll.
    // Unfixed code is still inside waitForRemoteQueue, so neither updates.
    cy.contains('Saving', { timeout: 800 }).should('be.visible');
    cy.get('#res-edit-tab-1', { timeout: 800 }).should(
      'have.attr',
      'aria-selected',
      'true'
    );
  });

  it('creates one shared resource when Add is clicked again while saving', () => {
    const records: RecordsByKey = { ...notePassage };
    let releaseSave: () => void = () => undefined;
    const saveGate = new Promise<void>((resolve) => {
      releaseSave = resolve;
    });
    const sharedResourceCount = () =>
      Object.keys(records).filter((key) => key.startsWith('sharedresource:'))
        .length;

    mountTabs({
      records,
      holdSharedResourceAdd: () => saveGate,
    });

    cy.get(`#note-${PASSAGE_ID}adornment`, { timeout: 4000 }).type(
      'Morning note'
    );
    cy.contains('.MuiFormControl-root', 'Category')
      .find('input[role="combobox"]')
      .clear()
      .type('Field Note');
    cy.get('#resSave').should('not.be.disabled').click();

    // First create has been handed to Orbit and is still awaiting persist.
    cy.wrap(null).should(() => {
      expect(sharedResourceCount()).to.eq(1);
    });
    // Unfixed Add stays enabled through that delay, so another click is a
    // second addRecord and the server returns 500.
    cy.get('#resSave', { timeout: 800 }).should('be.disabled');
    cy.get('#resSave').click({ force: true });
    cy.wrap(null).should(() => {
      expect(sharedResourceCount()).to.eq(1);
    });

    cy.then(() => releaseSave());
    cy.get('#res-edit-tab-1', { timeout: 800 }).should(
      'have.attr',
      'aria-selected',
      'true'
    );
  });
});
