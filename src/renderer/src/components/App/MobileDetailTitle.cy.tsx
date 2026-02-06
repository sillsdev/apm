import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../auth/bugsnagClient';
import { GlobalProvider, GlobalState } from '../../context/GlobalContext';
import DataProvider from '../../hoc/DataProvider';
import { BookName, PassageD, ProjectD } from '../../model';
import MobileDetailTitle from './MobileDetailTitle';

const createMockMemory = (
  passages: PassageD[] = [],
  projects: ProjectD[] = []
): Memory => {
  const recordsByType: Record<string, unknown[]> = {
    passage: passages,
    project: projects,
  };

  const createMockQueryBuilder = () => ({
    findRecords: (type: string) => recordsByType[type] ?? [],
  });

  return {
    cache: {
      query: (queryFn: (q: any) => any) => queryFn(createMockQueryBuilder()),
      liveQuery: (queryFn: (q: any) => any) => ({
        subscribe: () => () => {},
        query: () => queryFn(createMockQueryBuilder()),
      }),
    },
    update: () => {},
  } as unknown as Memory;
};

const mockCoordinator = {
  getSource: () => createMockMemory(),
} as unknown as Coordinator;

const createStoreWithBookData = (bookData: BookName[] = []) =>
  createStore(
    combineReducers({
      books: () => ({ bookData }),
    })
  );

const createInitialState = (
  overrides: Partial<GlobalState> = {}
): GlobalState => ({
  coordinator: mockCoordinator,
  errorReporter: bugsnagClient,
  fingerprint: 'test-fingerprint',
  memory: createMockMemory(),
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

const mountMobileDetailTitle = ({
  pasId,
  passages = [],
  projects = [],
  projectId = '',
  bookData = [],
}: {
  pasId: string;
  passages?: PassageD[];
  projects?: ProjectD[];
  projectId?: string;
  bookData?: BookName[];
}) => {
  const memory = createMockMemory(passages, projects);
  const store = createStoreWithBookData(bookData);
  const initialState = createInitialState({ project: projectId, memory });

  cy.mount(
    <Provider store={store}>
      <GlobalProvider init={initialState}>
        <DataProvider dataStore={memory}>
          <MemoryRouter initialEntries={[`/passage/${pasId}`]}>
            <Routes>
              <Route path="/passage/:pasId" element={<MobileDetailTitle />} />
            </Routes>
          </MemoryRouter>
        </DataProvider>
      </GlobalProvider>
    </Provider>
  );
};

describe('MobileDetailTitle', () => {
  it('should render passage reference and project name', () => {
    const pasId = 'passage-1';
    const passages = [
      {
        id: pasId,
        type: 'passage',
        attributes: {
          book: 'GEN',
          reference: '1:1',
        },
        relationships: {},
      } as PassageD,
    ];
    const projectId = 'project-1';
    const projects = [
      {
        id: projectId,
        type: 'project',
        attributes: {
          name: 'Test Project',
        },
      } as ProjectD,
    ];
    const bookData = [
      {
        code: 'GEN',
        abbr: 'Gen',
      } as BookName,
    ];

    mountMobileDetailTitle({
      pasId,
      passages,
      projects,
      projectId,
      bookData,
    });

    cy.contains('Gen 1:1').should('be.visible');
    cy.contains('Test Project').should('be.visible');
  });

  it('should resolve passage using remoteId', () => {
    const pasId = 'remote-123';
    const passages = [
      {
        id: 'local-1',
        type: 'passage',
        attributes: {
          book: 'EXO',
          reference: '2:3',
        },
        keys: {
          remoteId: pasId,
        },
        relationships: {},
      } as unknown as PassageD,
    ];
    const bookData = [
      {
        code: 'EXO',
        abbr: 'Ex',
      } as BookName,
    ];

    mountMobileDetailTitle({
      pasId,
      passages,
      bookData,
    });

    cy.contains('Ex 2:3').should('be.visible');
  });

  it('should show empty reference when passage is missing', () => {
    mountMobileDetailTitle({
      pasId: 'missing-passage',
    });

    cy.get('.MuiTypography-subtitle2').should('have.text', '');
  });

  it('should show empty project name when project is not found', () => {
    const pasId = 'passage-2';
    const passages = [
      {
        id: pasId,
        type: 'passage',
        attributes: {
          book: 'GEN',
          reference: '3:16',
        },
        relationships: {},
      } as PassageD,
    ];

    mountMobileDetailTitle({
      pasId,
      passages,
      projectId: 'missing-project',
    });

    cy.get('.MuiTypography-caption').should('have.text', '');
  });
});
