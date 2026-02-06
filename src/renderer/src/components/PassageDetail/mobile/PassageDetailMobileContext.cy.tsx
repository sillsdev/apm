import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../../auth/bugsnagClient';
import { GlobalProvider, GlobalState } from '../../../context/GlobalContext';
import { OrbitContext } from '../../../hoc/OrbitContextProvider';
import {
  PassageDetailContext,
  ICtxState,
} from '../../../context/PassageDetailContext';
import { BookName, PassageD, ProjectD } from '../../../model';
import PassageDetailMobileContext from './PassageDetailMobileContext';

type RecordsByType = Record<string, unknown[]>;

const createMockQueryBuilder = (recordsByType: RecordsByType) => ({
  findRecords: (type: string) => recordsByType[type] ?? [],
});

const createMockMemory = (recordsByType: RecordsByType): Memory =>
  ({
    cache: {
      query: (queryFn: (q: any) => any) =>
        queryFn(createMockQueryBuilder(recordsByType)),
      liveQuery: (queryFn: (q: any) => any) => ({
        subscribe: () => () => {},
        query: () => queryFn(createMockQueryBuilder(recordsByType)),
      }),
    },
    update: () => {},
  }) as unknown as Memory;

const mockCoordinator = {
  getSource: () => createMockMemory({}),
} as unknown as Coordinator;

const createInitialState = (
  overrides: Partial<GlobalState> = {}
): GlobalState => ({
  coordinator: mockCoordinator,
  errorReporter: bugsnagClient,
  fingerprint: 'test-fingerprint',
  memory: createMockMemory({}),
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
  ...overrides,
});

const mockStore = createStore(
  combineReducers({
    strings: () => ({ loaded: true, lang: 'en' }),
  })
);

const createPassageDetailState = (
  overrides: Partial<ICtxState> = {}
): ICtxState =>
  ({
    passage: {
      id: 'passage-1',
      type: 'passage',
      attributes: {
        book: 'GEN',
        reference: '1:1',
      },
    } as PassageD,
    allBookData: [
      {
        code: 'GEN',
        abbr: 'Gen',
      } as BookName,
    ],
    ...overrides,
  }) as ICtxState;

const mountContext = ({
  projects = [],
  projectId = '',
  passageOverrides = {},
  bookDataOverrides,
}: {
  projects?: ProjectD[];
  projectId?: string;
  passageOverrides?: Partial<PassageD>;
  bookDataOverrides?: BookName[];
}) => {
  const recordsByType: RecordsByType = {
    project: projects,
  };
  const memory = createMockMemory(recordsByType);
  const orbitCache = new Map<string, any[]>();
  const orbitContextValue = {
    memory,
    getRecs: (type: string) => orbitCache.get(type),
    setRecs: (type: string, recs: any[] | undefined) => {
      if (recs === undefined) orbitCache.delete(type);
      else orbitCache.set(type, recs);
    },
  };
  const ctxState = createPassageDetailState({
    passage: {
      ...(createPassageDetailState().passage as PassageD),
      ...passageOverrides,
    } as PassageD,
    allBookData:
      bookDataOverrides ?? createPassageDetailState().allBookData ?? [],
  });
  const initialState = createInitialState({ project: projectId, memory });

  cy.mount(
    <Provider store={mockStore}>
      <GlobalProvider init={initialState}>
        <OrbitContext.Provider value={orbitContextValue}>
          <PassageDetailContext.Provider
            value={{ state: ctxState, setState: cy.stub() }}
          >
            <PassageDetailMobileContext />
          </PassageDetailContext.Provider>
        </OrbitContext.Provider>
      </GlobalProvider>
    </Provider>
  );
};

describe('PassageDetailMobileContext', () => {
  it('renders passage reference and project name', () => {
    const projectId = 'project-1';
    const projects = [
      {
        id: projectId,
        type: 'project',
        attributes: { name: 'Test Project' },
      } as ProjectD,
    ];

    mountContext({ projects, projectId });

    cy.contains('Gen 1:1').should('be.visible');
    cy.contains('Test Project').should('be.visible');
  });

  it('renders empty project name when project is missing', () => {
    mountContext({ projectId: 'missing-project' });

    cy.get('[data-cy="mobile-project-name"]').should('have.text', '');
  });

  it('falls back to book code when book data is missing', () => {
    const baseAttributes = createPassageDetailState().passage.attributes;
    mountContext({
      bookDataOverrides: [],
      passageOverrides: {
        attributes: { ...baseAttributes, book: 'EXO', reference: '2:3' },
      },
    });

    cy.contains('EXO 2:3').should('be.visible');
  });

  it('renders empty reference when passage reference is missing', () => {
    const baseAttributes = createPassageDetailState().passage.attributes;
    mountContext({
      passageOverrides: {
        attributes: { ...baseAttributes, book: '', reference: '' },
      },
    });

    cy.get('[data-cy="mobile-reference"]').should('have.text', ' ');
  });
});
