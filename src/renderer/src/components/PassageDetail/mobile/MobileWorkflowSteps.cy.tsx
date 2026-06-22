import React from 'react';
import { MemoryRouter } from 'react-router-dom';
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
import { UnsavedContext } from '../../../context/UnsavedContext';
import { OrbitContext } from '../../../hoc/OrbitContextProvider';
import MobileWorkflowSteps from './MobileWorkflowSteps';

type RecordsByKey = Record<string, any>;

const createMockQueryBuilder = (records: RecordsByKey = {}) => ({
  findRecords: (type: string) =>
    Object.entries(records)
      .filter(([key]) => key.startsWith(`${type}:`))
      .map(([, rec]) => rec),
  findRecord: ({ type, id }: { type: string; id: string }) =>
    records[`${type}:${id}`],
});

/** Mock memory: supports findRecord, findRecords, and liveQuery (for useOrbitData). */
const createMockMemory = (records: RecordsByKey = {}): Memory =>
  ({
    cache: {
      query: (
        queryFn: (q: ReturnType<typeof createMockQueryBuilder>) => unknown
      ) => queryFn(createMockQueryBuilder(records)),
      liveQuery: (
        queryFn: (q: ReturnType<typeof createMockQueryBuilder>) => unknown
      ) => ({
        subscribe: () => () => {},
        query: () => queryFn(createMockQueryBuilder(records)),
      }),
    },
    update: () => {},
  }) as unknown as Memory;

const mockCoordinator = {
  getSource: () => createMockMemory(),
} as unknown as Coordinator;

const stepProgressionOrgRecord = {
  type: 'organization',
  id: 'test-org',
  attributes: {
    defaultParams: JSON.stringify({ WorkflowProgression: 'step' }),
  },
};

// Two passage records used in passage progression mode tests
const mockSectionPassageRecords = {
  'passage:p-1': {
    id: 'p-1',
    attributes: { sequencenum: 1, reference: '1:1', book: 'GEN' },
  },
  'passage:p-2': {
    id: 'p-2',
    attributes: { sequencenum: 2, reference: '1:2', book: 'GEN' },
  },
};

// Extended set with an earlier passage (sequencenum 0) to cover the "complete" colour state
const mockSectionPassageRecordsWithPrior = {
  'passage:p-0': {
    id: 'p-0',
    attributes: { sequencenum: 0, reference: '1:0', book: 'GEN' },
  },
  ...mockSectionPassageRecords,
};

const mockSectionWithThreePassages = {
  id: 'section-1',
  relationships: {
    passages: {
      data: [
        { type: 'passage', id: 'p-0' },
        { type: 'passage', id: 'p-1' },
        { type: 'passage', id: 'p-2' },
      ],
    },
  },
} as any;

// Section whose passages relationship points to the records above
const mockSection = {
  id: 'section-1',
  relationships: {
    passages: {
      data: [
        { type: 'passage', id: 'p-1' },
        { type: 'passage', id: 'p-2' },
      ],
    },
  },
} as any;

// Section with only the current passage (single dropdown option)
const mockSectionSinglePassage = {
  id: 'section-1',
  relationships: {
    passages: {
      data: [{ type: 'passage', id: 'p-1' }],
    },
  },
} as any;

const mockSectionPassageRecordsSingle = {
  'passage:p-1': mockSectionPassageRecords['passage:p-1'],
};

const mockCurrentPassage = {
  id: 'p-1',
  attributes: { sequencenum: 1, reference: '1:1', book: 'GEN' },
} as any;

const createInitialState = (
  overrides: Partial<GlobalState> = {}
): GlobalState => ({
  coordinator: mockCoordinator,
  errorReporter: bugsnagClient,
  fingerprint: 'test-fingerprint',
  memory: createMockMemory(),
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
    close: 'Close',
  },
});

const mockWorkflowStepsStrings = new LocalizedStrings({
  en: {
    record: 'Record',
    review: 'Review',
    recordTip: 'Record tip',
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
  anySaving: () => false as const,
  saveRequested: () => false as const,
  clearRequested: () => false as const,
  isChanged: () => false as const,
  toolsChanged: {},
};

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
    stepComplete: () => false,
    setCurrentStep: cy.stub(),
    isNavigationBlocked: () => false,
    passage: mockCurrentPassage,
    section: {} as any,
    prjId: 'proj-1',
    ...overrides,
  }) as ICtxState;

const mountMobileWorkflowSteps = ({
  currentstep = 'step-1',
  workflow,
  completedStepIds = [],
  remoteBusy = false,
  recording = false,
  commentRecording = false,
  isStepProgression = false,
  section,
  passage,
  extraMemoryRecords = {},
}: {
  currentstep?: string;
  workflow?: ICtxState['workflow'];
  completedStepIds?: string[];
  remoteBusy?: boolean;
  recording?: boolean;
  commentRecording?: boolean;
  isStepProgression?: boolean;
  section?: any;
  passage?: any;
  extraMemoryRecords?: Record<string, any>;
} = {}) => {
  const setCurrentStep = cy.stub().as('setCurrentStep');
  const ctxOverrides: Partial<ICtxState> = {
    currentstep,
    recording,
    commentRecording,
    setCurrentStep,
    stepComplete: (id: string) => completedStepIds.includes(id),
    ...(section !== undefined ? { section } : {}),
    ...(passage !== undefined ? { passage } : {}),
  };
  if (workflow) ctxOverrides.workflow = workflow;
  const ctxState = createPassageDetailState(ctxOverrides);

  const mem = createMockMemory({
    ...(isStepProgression
      ? { 'organization:test-org': stepProgressionOrgRecord }
      : {}),
    ...extraMemoryRecords,
  });
  const orbitCache = new Map<string, any[]>();
  const orbitContextValue = {
    memory: mem,
    getRecs: (type: string) => orbitCache.get(type),
    setRecs: (type: string, recs: any[] | undefined) => {
      if (recs === undefined) orbitCache.delete(type);
      else orbitCache.set(type, recs);
    },
  };
  const initialState = createInitialState({ remoteBusy, memory: mem });

  cy.mount(
    <MemoryRouter>
      <Provider store={mockStore}>
        <GlobalProvider init={initialState}>
          <OrbitContext.Provider value={orbitContextValue}>
            <SnackBarProvider>
              <UnsavedContext.Provider
                value={{ state: mockUnsavedState, setState: cy.stub() }}
              >
                <PassageDetailContext.Provider
                  value={{ state: ctxState, setState: cy.stub() }}
                >
                  <MobileWorkflowSteps />
                </PassageDetailContext.Provider>
              </UnsavedContext.Provider>
            </SnackBarProvider>
          </OrbitContext.Provider>
        </GlobalProvider>
      </Provider>
    </MemoryRouter>
  );
};

describe('MobileWorkflowSteps', () => {
  describe('step progression mode', () => {
    it('renders workflow step parallelograms and current step label', () => {
      mountMobileWorkflowSteps({ isStepProgression: true });

      cy.get('[data-cy="workflow-step"]').should('have.length', 2);
      cy.get('[data-cy="workflow-step-label"]').should(
        'contain.text',
        'Record'
      );
    });

    it('shows current, complete, and incomplete step colors', () => {
      mountMobileWorkflowSteps({
        isStepProgression: true,
        workflow: [
          { id: 'step-1', label: 'Record' },
          { id: 'step-2', label: 'Review' },
          { id: 'step-3', label: 'Publish' },
        ],
        completedStepIds: ['step-2'],
      });

      cy.get('[data-cy="workflow-step"]')
        .eq(0)
        .should('have.css', 'background-color', 'rgb(97, 97, 97)');
      cy.get('[data-cy="workflow-step"]')
        .eq(1)
        .should('have.css', 'background-color', 'rgb(189, 189, 189)');
      cy.get('[data-cy="workflow-step"]')
        .eq(2)
        .should('have.css', 'background-color', 'rgb(238, 238, 238)');
    });

    it('shows a tip button in the step label area that opens a dialog', () => {
      mountMobileWorkflowSteps({ isStepProgression: true });

      cy.get(
        '[data-cy="workflow-step-label"] [data-cy="workflow-step-tip"]'
      ).click();

      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Record tip').should('be.visible');
      cy.contains('Close').click();
      cy.get('[role="dialog"]').should('not.exist');
    });

    it('selects a different step when a parallelogram is clicked', () => {
      mountMobileWorkflowSteps({ isStepProgression: true });

      cy.get('[data-cy="workflow-step"]').eq(1).click();

      cy.get('@setCurrentStep').should('have.been.calledWith', 'step-2');
    });

    it('does not re-select the current step', () => {
      mountMobileWorkflowSteps({ isStepProgression: true });

      cy.get('[data-cy="workflow-step"]').eq(0).click();

      cy.get('@setCurrentStep').should('not.have.been.called');
    });

    it('blocks step selection and shows wait message when remote is busy', () => {
      mountMobileWorkflowSteps({ isStepProgression: true, remoteBusy: true });

      cy.get('[data-cy="workflow-step"]').eq(1).click();

      cy.get('@setCurrentStep').should('not.have.been.called');
      cy.contains('Please wait').should('be.visible');
    });

    it('blocks step selection while recording', () => {
      mountMobileWorkflowSteps({ isStepProgression: true, recording: true });

      cy.get('[data-cy="workflow-step"]').eq(1).click();

      cy.get('@setCurrentStep').should('not.have.been.called');
    });

    it('blocks step selection while comment recording', () => {
      mountMobileWorkflowSteps({
        isStepProgression: true,
        commentRecording: true,
      });

      cy.get('[data-cy="workflow-step"]').eq(1).click();

      cy.get('@setCurrentStep').should('not.have.been.called');
    });

    it('blocks passage dropdown while recording', () => {
      mountMobileWorkflowSteps({ isStepProgression: true, recording: true });

      cy.get('[data-cy="passage-dropdown"]').click();

      cy.get('[role="menu"]').should('not.exist');
    });

    it('blocks passage dropdown and shows wait message when remote is busy', () => {
      mountMobileWorkflowSteps({
        isStepProgression: true,
        remoteBusy: true,
        section: mockSection,
        extraMemoryRecords: mockSectionPassageRecords,
      });

      cy.get('[data-cy="passage-dropdown"]').click();

      cy.get('[role="menu"]').should('not.exist');
      cy.contains('Please wait').should('be.visible');
    });

    it('dropdown shows current passage book and reference', () => {
      mountMobileWorkflowSteps({ isStepProgression: true });

      cy.get('[data-cy="passage-dropdown"]').should('contain.text', 'GEN 1:1');
    });

    it('dropdown opens section passages as menu items', () => {
      mountMobileWorkflowSteps({
        isStepProgression: true,
        section: mockSection,
        extraMemoryRecords: mockSectionPassageRecords,
      });

      cy.get('[data-cy="passage-dropdown"]').click();

      cy.get('[role="menu"]').should('be.visible');
      cy.get('[role="menuitem"]').should('have.length', 2);
      cy.get('[role="menuitem"]').eq(0).should('contain.text', 'GEN 1:1');
    });

    it('does not open the dropdown when the section has only one passage', () => {
      mountMobileWorkflowSteps({
        isStepProgression: true,
        section: mockSectionSinglePassage,
        extraMemoryRecords: mockSectionPassageRecordsSingle,
      });

      cy.get('[data-cy="passage-dropdown"]')
        .should('contain.text', 'GEN 1:1')
        .find('[data-testid="ArrowDropDownIcon"]')
        .should('not.exist');

      cy.get('[data-cy="passage-dropdown"]').click();

      cy.get('[role="menu"]').should('not.exist');
    });

    it('renders the step label as plain text when the current step has no tip', () => {
      mountMobileWorkflowSteps({
        isStepProgression: true,
        currentstep: 'step-2',
      });

      cy.get('[data-cy="workflow-step-label"]').should(
        'contain.text',
        'Review'
      );
      cy.get('[data-cy="workflow-step-tip"]').should('not.exist');
    });
  });

  describe('passage progression mode', () => {
    it('renders passage parallelograms for each section passage', () => {
      mountMobileWorkflowSteps({
        section: mockSection,
        extraMemoryRecords: mockSectionPassageRecords,
      });

      cy.get('[data-cy="passage-step"]').should('have.length', 2);
    });

    it('shows a tip button left of the dropdown that opens a dialog', () => {
      mountMobileWorkflowSteps();

      cy.get('[data-cy="workflow-step-tip"]').click();

      cy.get('[role="dialog"]').should('be.visible');
      cy.contains('Record tip').should('be.visible');
      cy.contains('Close').click();
      cy.get('[role="dialog"]').should('not.exist');
    });

    it('dropdown shows the current workflow step label', () => {
      mountMobileWorkflowSteps();

      cy.get('[data-cy="passage-dropdown"]').should('contain.text', 'Record');
    });

    it('dropdown opens a menu with workflow step options', () => {
      mountMobileWorkflowSteps();

      cy.get('[data-cy="passage-dropdown"]').click();

      cy.get('[role="menu"]').should('be.visible');
      cy.get('[role="menuitem"]').should('have.length', 2);
    });

    it('does not open the dropdown when there is only one workflow step', () => {
      mountMobileWorkflowSteps({
        workflow: [{ id: 'step-1', label: 'Record' }],
      });

      cy.get('[data-cy="passage-dropdown"]')
        .should('contain.text', 'Record')
        .find('[data-testid="ArrowDropDownIcon"]')
        .should('not.exist');

      cy.get('[data-cy="passage-dropdown"]').click();

      cy.get('[role="menu"]').should('not.exist');
    });

    it('blocks passage click while recording', () => {
      mountMobileWorkflowSteps({
        section: mockSection,
        extraMemoryRecords: mockSectionPassageRecords,
        recording: true,
      });

      cy.get('[data-cy="passage-step"]').eq(1).click();

      cy.get('@setCurrentStep').should('not.have.been.called');
    });

    it('blocks passage click and shows wait message when remote is busy', () => {
      mountMobileWorkflowSteps({
        section: mockSection,
        extraMemoryRecords: mockSectionPassageRecords,
        remoteBusy: true,
      });

      cy.get('[data-cy="passage-step"]').eq(1).click();

      cy.contains('Please wait').should('be.visible');
    });

    it('shows current, complete, and incomplete passage step colors', () => {
      mountMobileWorkflowSteps({
        section: mockSectionWithThreePassages,
        extraMemoryRecords: mockSectionPassageRecordsWithPrior,
      });

      // p-0 sequencenum 0 < current sequencenum 1 → complete
      cy.get('[data-cy="passage-step"]')
        .eq(0)
        .should('have.css', 'background-color', 'rgb(189, 189, 189)');
      // p-1 is current passage
      cy.get('[data-cy="passage-step"]')
        .eq(1)
        .should('have.css', 'background-color', 'rgb(97, 97, 97)');
      // p-2 sequencenum 2 > current sequencenum 1 → incomplete
      cy.get('[data-cy="passage-step"]')
        .eq(2)
        .should('have.css', 'background-color', 'rgb(238, 238, 238)');
    });

    it('step label shows current passage book and reference', () => {
      mountMobileWorkflowSteps();

      cy.get('[data-cy="workflow-step-label"]').should(
        'contain.text',
        'GEN 1:1'
      );
    });

    it('blocks dropdown while comment recording', () => {
      mountMobileWorkflowSteps({ commentRecording: true });

      cy.get('[data-cy="passage-dropdown"]').click();

      cy.get('[role="menu"]').should('not.exist');
    });

    it('blocks passage click while comment recording', () => {
      mountMobileWorkflowSteps({
        section: mockSection,
        extraMemoryRecords: mockSectionPassageRecords,
        commentRecording: true,
      });

      cy.get('[data-cy="passage-step"]').eq(1).click();

      cy.get('@setCurrentStep').should('not.have.been.called');
    });
  });
});
