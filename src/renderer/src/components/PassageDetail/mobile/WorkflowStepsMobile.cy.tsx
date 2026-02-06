import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import LocalizedStrings from 'react-localization';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../../auth/bugsnagClient';
import { GlobalProvider, GlobalState } from '../../../context/GlobalContext';
import SnackBarProvider from '../../../hoc/SnackBar';
import {
  PassageDetailContext,
  ICtxState,
} from '../../../context/PassageDetailContext';
import WorkflowStepsMobile from './WorkflowStepsMobile';

const createMockMemory = (): Memory =>
  ({
    cache: {
      query: () => [],
      liveQuery: () => ({
        subscribe: () => () => {},
        query: () => [],
      }),
    },
    update: () => {},
  }) as unknown as Memory;

const mockCoordinator = {
  getSource: () => createMockMemory(),
} as unknown as Coordinator;

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

const mockSharedStrings = new LocalizedStrings({
  en: {
    wait: 'Please wait',
  },
});

const mockWorkflowStepsStrings = new LocalizedStrings({
  en: {
    record: 'Record',
    review: 'Review',
    edit: 'Edit',
    approve: 'Approve',
  },
});

const mockStringsReducer = () => ({
  loaded: true,
  lang: 'en',
  shared: mockSharedStrings,
  workflowSteps: mockWorkflowStepsStrings,
});

const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
  })
);

const createPassageDetailState = (
  overrides: Partial<ICtxState> = {}
): ICtxState =>
  (() => {
    const baseState = {
      workflow: [
        { id: 'step-1', label: 'Record' },
        { id: 'step-2', label: 'Review' },
      ],
      currentstep: 'step-1',
      firstStepIndex: -1,
      recording: false,
      commentRecording: false,
      setCurrentStep: cy.stub(),
      setFirstStepIndex: cy.stub(),
      stepComplete: cy.stub().returns(false),
    };
    return {
      ...baseState,
      ...overrides,
      workflow: overrides.workflow ?? baseState.workflow,
    };
  })() as ICtxState;

const mountWorkflowStepsMobile = ({
  currentstep = 'step-1',
  remoteBusy = false,
  recording = false,
  commentRecording = false,
  workflow,
  firstStepIndex = -1,
  viewport,
}: {
  currentstep?: string;
  remoteBusy?: boolean;
  recording?: boolean;
  commentRecording?: boolean;
  workflow?: { id: string; label: string }[];
  firstStepIndex?: number;
  viewport?: { width: number; height: number };
} = {}) => {
  if (viewport) {
    cy.viewport(viewport.width, viewport.height);
  }
  const setCurrentStep = cy.stub().as('setCurrentStep');
  const setFirstStepIndex = cy.stub().as('setFirstStepIndex');
  const ctxState = createPassageDetailState({
    currentstep,
    recording,
    commentRecording,
    workflow,
    firstStepIndex,
    setCurrentStep,
    setFirstStepIndex,
  });
  const initialState = createInitialState({ remoteBusy });

  cy.mount(
    <Provider store={mockStore}>
      <GlobalProvider init={initialState}>
        <SnackBarProvider>
          <PassageDetailContext.Provider
            value={{ state: ctxState, setState: cy.stub() }}
          >
            <WorkflowStepsMobile />
          </PassageDetailContext.Provider>
        </SnackBarProvider>
      </GlobalProvider>
    </Provider>
  );
  if (viewport) {
    cy.window().then((win) => {
      Object.defineProperty(win, 'innerWidth', {
        value: viewport.width,
        configurable: true,
      });
      win.dispatchEvent(new Event('resize'));
    });
  }
};

describe('WorkflowStepsMobile', () => {
  it('renders workflow steps and the current label', () => {
    mountWorkflowStepsMobile({ viewport: { width: 1000, height: 600 } });

    cy.get('svg').should('have.length.at.least', 2);
  });

  it('selects a different step when clicked', () => {
    mountWorkflowStepsMobile({ viewport: { width: 1000, height: 600 } });

    cy.get('svg g').eq(1).click();

    cy.get('@setCurrentStep').should('have.been.calledWith', 'step-2');
  });

  it('does not re-select the current step', () => {
    mountWorkflowStepsMobile({ viewport: { width: 1000, height: 600 } });

    cy.get('svg g').eq(0).click();

    cy.get('@setCurrentStep').should('not.have.been.called');
  });

  it('blocks selection and shows wait message when remote busy', () => {
    mountWorkflowStepsMobile({
      remoteBusy: true,
      viewport: { width: 1000, height: 600 },
    });

    cy.get('svg g').eq(1).click();

    cy.get('@setCurrentStep').should('not.have.been.called');
    cy.contains('Please wait').should('be.visible');
  });

  it('blocks selection while recording', () => {
    mountWorkflowStepsMobile({
      recording: true,
      viewport: { width: 1000, height: 600 },
    });

    cy.get('svg g').eq(1).click();

    cy.get('@setCurrentStep').should('not.have.been.called');
  });

  it('moves to the next group when pagination is available', () => {
    mountWorkflowStepsMobile({
      workflow: [
        { id: 'step-1', label: 'Record' },
        { id: 'step-2', label: 'Review' },
        { id: 'step-3', label: 'Edit' },
        { id: 'step-4', label: 'Approve' },
      ],
      firstStepIndex: 0,
      viewport: { width: 320, height: 600 },
    });

    cy.get('#next').should('be.enabled').click();

    cy.get('@setFirstStepIndex').should('have.been.calledWith', 1);
  });
});
