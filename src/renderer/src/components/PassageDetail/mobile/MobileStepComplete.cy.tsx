import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import LocalizedStrings from 'react-localization';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../../auth/bugsnagClient';
import { GlobalProvider, GlobalState } from '../../../context/GlobalContext';
import { OrbitContext } from '../../../hoc/OrbitContextProvider';
import {
  PassageDetailContext,
  ICtxState,
} from '../../../context/PassageDetailContext';
import { PassageD, RoleNames, SectionD } from '../../../model';
import MobileStepComplete from './MobileStepComplete';

type RecordsByType = Record<string, any[]>;

const createMockQueryBuilder = (recordsByType: RecordsByType) => ({
  findRecords: (type: string) => recordsByType[type] ?? [],
  findRecord: (identity: { type: string; id: string }) =>
    (recordsByType[identity.type] ?? []).find((rec) => rec.id === identity.id),
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

const mockStepCompleteStrings = new LocalizedStrings({
  en: {
    title: 'Complete',
    incomplete: 'Incomplete',
    setNext: 'Set next',
  },
});

const mockStringsReducer = () => ({
  loaded: true,
  lang: 'en',
  passageDetailStepComplete: mockStepCompleteStrings,
});

const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
  })
);

const createPassageDetailState = (
  overrides: Partial<ICtxState> = {}
): ICtxState =>
  ({
    currentstep: 'step-1',
    psgCompleted: [],
    section: {
      id: 'section-1',
      type: 'section',
      relationships: {
        organizationScheme: {
          data: { type: 'organizationscheme', id: 'scheme-1' },
        },
      },
    } as SectionD,
    passage: { id: 'passage-1', type: 'passage' } as PassageD,
    recording: false,
    stepComplete: () => false,
    setStepComplete: cy.stub().resolves(),
    gotoNextStep: cy.stub(),
    ...overrides,
  }) as ICtxState;

const mountMobileStepComplete = ({
  hasPermission = true,
  complete = false,
  recording = false,
  remoteBusy = false,
  importexportBusy = false,
}: {
  hasPermission?: boolean;
  complete?: boolean;
  recording?: boolean;
  remoteBusy?: boolean;
  importexportBusy?: boolean;
} = {}) => {
  const setStepComplete = cy.stub().as('setStepComplete').resolves();
  const gotoNextStep = cy.stub().as('gotoNextStep');
  const stepComplete = cy.stub().returns(complete);
  const orgRole = hasPermission ? RoleNames.Admin : RoleNames.Member;
  const recordsByType: RecordsByType = {
    organization: [
      {
        id: 'org-1',
        type: 'organization',
        attributes: {
          defaultParams: JSON.stringify({ permissions: true }),
        },
      },
    ],
    organizationschemestep: hasPermission
      ? []
      : [
          {
            id: 'scheme-step-1',
            type: 'organizationschemestep',
            attributes: {},
            relationships: {
              organizationscheme: {
                data: { type: 'organizationscheme', id: 'scheme-1' },
              },
              orgWorkflowStep: {
                data: { type: 'orgworkflowstep', id: 'step-1' },
              },
              user: {
                data: { type: 'user', id: 'user-2' },
              },
            },
          },
        ],
    orgworkflowstep: [
      {
        id: 'step-1',
        type: 'orgworkflowstep',
        attributes: { tool: '{}' },
        relationships: {
          organization: { data: { type: 'organization', id: 'org-1' } },
        },
      },
    ],
    group: [],
    groupmembership: [],
    user: [{ id: 'user-1', type: 'user', attributes: { name: 'User One' } }],
    role: [],
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
    recording,
    stepComplete,
    setStepComplete,
    gotoNextStep,
  });
  const initialState = createInitialState({
    remoteBusy,
    importexportBusy,
    memory,
    organization: 'org-1',
    user: 'user-1',
    orgRole,
  });

  cy.mount(
    <Provider store={mockStore}>
      <GlobalProvider init={initialState}>
        <OrbitContext.Provider value={orbitContextValue}>
          <PassageDetailContext.Provider
            value={{ state: ctxState, setState: cy.stub() }}
          >
            <MobileStepComplete />
          </PassageDetailContext.Provider>
        </OrbitContext.Provider>
      </GlobalProvider>
    </Provider>
  );
};

describe('MobileStepComplete', () => {
  it('renders incomplete state by default', () => {
    mountMobileStepComplete();

    cy.get('#step-no').should('exist');
    cy.contains('Complete').should('be.visible');
  });

  it('renders complete state when step is complete', () => {
    mountMobileStepComplete({ complete: true });

    cy.get('#step-yes').should('exist');
  });

  it('toggles completion and moves to next step', () => {
    mountMobileStepComplete({ complete: false });

    cy.get('#mobile-complete').click();

    cy.get('@setStepComplete').should('have.been.calledWith', 'step-1', true);
    cy.get('@gotoNextStep').should('have.been.calledOnce');
  });

  it('does not move to next step when unchecking', () => {
    mountMobileStepComplete({ complete: true });

    cy.get('#mobile-complete').click();

    cy.get('@setStepComplete').should('have.been.calledWith', 'step-1', false);
    cy.get('@gotoNextStep').should('not.have.been.called');
  });

  it('disables when user lacks permission', () => {
    mountMobileStepComplete({ hasPermission: false });

    cy.get('#mobile-complete').should('be.disabled');
  });

  it('disables while recording', () => {
    mountMobileStepComplete({ recording: true });

    cy.get('#mobile-complete').should('be.disabled');
  });

  it('disables when remote busy', () => {
    mountMobileStepComplete({ remoteBusy: true });

    cy.get('#mobile-complete').should('be.disabled');
  });

  it('disables when import/export busy', () => {
    mountMobileStepComplete({ importexportBusy: true });

    cy.get('#mobile-complete').should('be.disabled');
  });
});
