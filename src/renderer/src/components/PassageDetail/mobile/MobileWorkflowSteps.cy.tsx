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
import MobileWorkflowSteps from './MobileWorkflowSteps';

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
  ({
    workflow: [
      { id: 'step-1', label: 'Record' },
      { id: 'step-2', label: 'Review' },
    ],
    currentstep: 'step-1',
    recording: false,
    commentRecording: false,
    setCurrentStep: cy.stub(),
    ...overrides,
  }) as ICtxState;

const mountMobileWorkflowSteps = ({
  currentstep = 'step-1',
  remoteBusy = false,
  recording = false,
  commentRecording = false,
}: {
  currentstep?: string;
  remoteBusy?: boolean;
  recording?: boolean;
  commentRecording?: boolean;
} = {}) => {
  const setCurrentStep = cy.stub().as('setCurrentStep');
  const ctxState = createPassageDetailState({
    currentstep,
    recording,
    commentRecording,
    setCurrentStep,
  });
  const initialState = createInitialState({ remoteBusy });

  cy.mount(
    <Provider store={mockStore}>
      <GlobalProvider init={initialState}>
        <SnackBarProvider>
          <PassageDetailContext.Provider
            value={{ state: ctxState, setState: cy.stub() }}
          >
            <MobileWorkflowSteps />
          </PassageDetailContext.Provider>
        </SnackBarProvider>
      </GlobalProvider>
    </Provider>
  );
};

describe('MobileWorkflowSteps', () => {
  it('renders workflow steps and current label', () => {
    mountMobileWorkflowSteps();

    cy.get('[data-cy="workflow-step"]').should('have.length', 2);
    cy.get('[data-cy="workflow-step-label"]').should('contain.text', 'Record');
  });

  it('selects a different step when clicked', () => {
    mountMobileWorkflowSteps();

    cy.get('[data-cy="workflow-step"]').eq(1).click();

    cy.get('@setCurrentStep').should('have.been.calledWith', 'step-2');
  });

  it('does not re-select the current step', () => {
    mountMobileWorkflowSteps();

    cy.get('[data-cy="workflow-step"]').eq(0).click();

    cy.get('@setCurrentStep').should('not.have.been.called');
  });

  it('blocks selection and shows wait message when remote busy', () => {
    mountMobileWorkflowSteps({ remoteBusy: true });

    cy.get('[data-cy="workflow-step"]').eq(1).click();

    cy.get('@setCurrentStep').should('not.have.been.called');
    cy.contains('Please wait').should('be.visible');
  });

  it('blocks selection while recording', () => {
    mountMobileWorkflowSteps({ recording: true });

    cy.get('[data-cy="workflow-step"]').eq(1).click();

    cy.get('@setCurrentStep').should('not.have.been.called');
  });

  it('blocks selection while comment recording', () => {
    mountMobileWorkflowSteps({ commentRecording: true });

    cy.get('[data-cy="workflow-step"]').eq(1).click();

    cy.get('@setCurrentStep').should('not.have.been.called');
  });
});
