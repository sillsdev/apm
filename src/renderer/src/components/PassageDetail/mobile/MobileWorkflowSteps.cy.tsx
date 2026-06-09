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
import { BookName } from '../../../model';
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
      query: (queryFn: (q: ReturnType<typeof createMockQueryBuilder>) => unknown) =>
        queryFn(createMockQueryBuilder(records)),
      liveQuery: (queryFn: (q: ReturnType<typeof createMockQueryBuilder>) => unknown) => ({
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

const hierarchyPlanRecord = {
  id: 'plan-1',
  type: 'plan',
  attributes: { name: 'Hierarchy Plan', flat: false },
};

const flatPlanRecord = {
  id: 'plan-flat',
  type: 'plan',
  attributes: { name: 'Flat Plan', flat: true },
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
  attributes: { sequencenum: 1, name: 'Section One' },
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
  attributes: { sequencenum: 1, name: 'Section One' },
  relationships: {
    passages: {
      data: [
        { type: 'passage', id: 'p-1' },
        { type: 'passage', id: 'p-2' },
      ],
    },
  },
} as any;

const mockSinglePassageSection = {
  id: 'section-1',
  attributes: { sequencenum: 2, name: 'Luke Section' },
  relationships: {
    passages: {
      data: [{ type: 'passage', id: 'p-1' }],
    },
  },
} as any;

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
    passage: mockCurrentPassage,
    section: {} as any,
    prjId: 'proj-1',
    allBookData: [],
    sectionArr: [],
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
  isFlat = false,
  section,
  passage,
  allBookData,
  sectionArr,
  extraMemoryRecords = {},
}: {
  currentstep?: string;
  workflow?: ICtxState['workflow'];
  completedStepIds?: string[];
  remoteBusy?: boolean;
  recording?: boolean;
  commentRecording?: boolean;
  isStepProgression?: boolean;
  isFlat?: boolean;
  section?: any;
  passage?: any;
  allBookData?: BookName[];
  sectionArr?: ICtxState['sectionArr'];
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
    ...(allBookData !== undefined ? { allBookData } : {}),
    ...(sectionArr !== undefined ? { sectionArr } : {}),
  };
  if (workflow) ctxOverrides.workflow = workflow;
  const ctxState = createPassageDetailState(ctxOverrides);

  const planId = isFlat ? 'plan-flat' : 'plan-1';
  const mem = createMockMemory({
    ...(isStepProgression
      ? { 'organization:test-org': stepProgressionOrgRecord }
      : {}),
    'plan:plan-1': hierarchyPlanRecord,
    'plan:plan-flat': flatPlanRecord,
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
  const initialState = createInitialState({
    remoteBusy,
    memory: mem,
    plan: planId,
  });

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
      mountMobileWorkflowSteps({ isStepProgression: true, remoteBusy: true });

      cy.get('[data-cy="passage-dropdown"]').click();

      cy.get('[role="menu"]').should('not.exist');
      cy.contains('Please wait').should('be.visible');
    });

    it('dropdown shows current passage book and reference (scripture)', () => {
      mountMobileWorkflowSteps({ isStepProgression: true });

      cy.get('[data-cy="passage-dropdown"]').should('contain.text', 'GEN 1:1');
    });

    it('dropdown uses passage ref text for scripture even when a shared resource exists', () => {
      mountMobileWorkflowSteps({
        isStepProgression: true,
        passage: {
          id: 'p-1',
          attributes: { sequencenum: 1, reference: '1:1-4', book: 'LUK' },
          relationships: {
            sharedResource: { data: { type: 'sharedresource', id: 'sr-1' } },
          },
        },
        section: mockSinglePassageSection,
        extraMemoryRecords: {
          'passage:p-1': {
            id: 'p-1',
            attributes: { sequencenum: 1, reference: '1:1-4', book: 'LUK' },
            relationships: {
              sharedResource: { data: { type: 'sharedresource', id: 'sr-1' } },
            },
          },
          'sharedresource:sr-1': {
            id: 'sr-1',
            attributes: { title: 'LUK_c001_001-004' },
          },
        },
      });

      cy.get('[data-cy="passage-dropdown"]').should('contain.text', 'LUK 1:1-4');
      cy.get('[data-cy="passage-dropdown"]').should(
        'not.contain.text',
        'LUK_c001_001-004'
      );
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

    it('keeps racetrack visible when passage dropdown menu is open', () => {
      mountMobileWorkflowSteps({
        isStepProgression: true,
        section: mockSection,
        extraMemoryRecords: mockSectionPassageRecords,
      });

      cy.viewport(375, 667);
      cy.get('[data-cy="passage-dropdown"]').click();

      cy.get('[role="menu"]').should('be.visible');
      cy.get('[data-cy="racetrack-row"]').should('be.visible');
      cy.get('[data-cy="workflow-step"]').should('have.length', 2);
    });

    it('constrains passage menu width and height for long references', () => {
      const longReference =
        'A very long general project topic title that should not widen the menu off screen';
      mountMobileWorkflowSteps({
        isStepProgression: true,
        isFlat: true,
        section: {
          id: 'section-1',
          relationships: {
            passages: { data: [{ type: 'passage', id: 'p-long' }] },
          },
        },
        passage: {
          id: 'p-long',
          attributes: { sequencenum: 1, reference: longReference, book: '' },
        },
        extraMemoryRecords: {
          'passage:p-long': {
            id: 'p-long',
            attributes: { sequencenum: 1, reference: longReference, book: '' },
          },
        },
      });

      cy.viewport(375, 667);
      cy.get('[data-cy="passage-dropdown"]').click();

      cy.get('[role="menu"]')
        .closest('.MuiPaper-root')
        .should(($paper) => {
          const maxWidth = parseFloat($paper.css('max-width'));
          expect(maxWidth).to.be.closeTo(375 - 24, 1);
        });
      cy.get('.MuiMenu-list').should(($list) => {
        const maxHeight = parseFloat($list.css('max-height'));
        expect(maxHeight).to.be.closeTo(667 * 0.45, 2);
      });
      cy.get('[role="menuitem"]')
        .first()
        .should('have.attr', 'title', longReference);
      cy.get('[data-cy="racetrack-row"]').should('be.visible');
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

    it('hides passage racetrack for a single passage in hierarchy projects', () => {
      mountMobileWorkflowSteps({
        section: mockSinglePassageSection,
        extraMemoryRecords: mockSectionPassageRecords,
        sectionArr: [[2, '2']],
      });

      cy.get('[data-cy="passage-step"]').should('not.exist');
      cy.get('[data-cy="racetrack-row"]').should('not.exist');
      cy.get('[data-cy="workflow-step-label"]').should(
        'contain.text',
        'Luke Section'
      );
      cy.get('[data-cy="workflow-step-label"]').should('contain.text', 'GEN 1:1');
    });

    it('hides passage racetrack for a single passage in flat projects', () => {
      mountMobileWorkflowSteps({
        isFlat: true,
        section: mockSinglePassageSection,
        extraMemoryRecords: mockSectionPassageRecords,
      });

      cy.get('[data-cy="passage-step"]').should('not.exist');
      cy.get('[data-cy="racetrack-row"]').should('not.exist');
      cy.get('[data-cy="workflow-step-label"]').should('contain.text', 'GEN 1:1');
      cy.get('[data-cy="workflow-step-label"]').should(
        'not.contain.text',
        'Luke Section'
      );
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

    it('keeps racetrack visible when workflow dropdown menu is open', () => {
      mountMobileWorkflowSteps({
        section: mockSection,
        extraMemoryRecords: mockSectionPassageRecords,
      });

      cy.viewport(375, 667);
      cy.get('[data-cy="passage-dropdown"]').click();

      cy.get('[role="menu"]').should('be.visible');
      cy.get('[data-cy="racetrack-row"]').should('be.visible');
      cy.get('[data-cy="passage-step"]').should('have.length', 2);
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

      cy.get('[data-cy="passage-step"]')
        .eq(0)
        .should('have.css', 'background-color', 'rgb(189, 189, 189)');
      cy.get('[data-cy="passage-step"]')
        .eq(1)
        .should('have.css', 'background-color', 'rgb(97, 97, 97)');
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

    it('step label uses passage ref text for scripture even when a shared resource exists', () => {
      mountMobileWorkflowSteps({
        section: mockSinglePassageSection,
        passage: {
          id: 'p-1',
          attributes: { sequencenum: 1, reference: '1:1-4', book: 'LUK' },
          relationships: {
            sharedResource: { data: { type: 'sharedresource', id: 'sr-1' } },
          },
        },
        extraMemoryRecords: {
          'passage:p-1': {
            id: 'p-1',
            attributes: { sequencenum: 1, reference: '1:1-4', book: 'LUK' },
            relationships: {
              sharedResource: { data: { type: 'sharedresource', id: 'sr-1' } },
            },
          },
          'sharedresource:sr-1': {
            id: 'sr-1',
            attributes: { title: 'LUK_c001_001-004' },
          },
        },
      });

      cy.get('[data-cy="workflow-step-label"]').should('contain.text', 'LUK 1:1-4');
      cy.get('[data-cy="workflow-step-label"]').should(
        'not.contain.text',
        'LUK_c001_001-004'
      );
    });

    it('step label shows shared resource title for note passages in flat projects', () => {
      mountMobileWorkflowSteps({
        isFlat: true,
        section: {
          id: 'section-1',
          attributes: { sequencenum: 1, name: 'Notes Section' },
          relationships: {
            passages: { data: [{ type: 'passage', id: 'p-note' }] },
          },
        },
        passage: {
          id: 'p-note',
          attributes: {
            sequencenum: 1,
            reference: 'NOTE|Devotional Note',
            book: '',
          },
          relationships: {
            sharedResource: { data: { type: 'sharedresource', id: 'sr-1' } },
          },
        },
        extraMemoryRecords: {
          'passage:p-note': {
            id: 'p-note',
            attributes: {
              sequencenum: 1,
              reference: 'NOTE|Devotional Note',
              book: '',
            },
            relationships: {
              sharedResource: { data: { type: 'sharedresource', id: 'sr-1' } },
            },
          },
          'sharedresource:sr-1': {
            id: 'sr-1',
            attributes: { title: 'My Devotional Title' },
          },
        },
      });

      cy.get('[data-cy="workflow-step-label"]').should(
        'contain.text',
        'My Devotional Title'
      );
      cy.get('[data-cy="workflow-step-label"]').should(
        'not.contain.text',
        'NOTE|'
      );
    });

    it('step label shows shared resource title for note passages in hierarchy projects', () => {
      mountMobileWorkflowSteps({
        section: {
          id: 'section-1',
          attributes: { sequencenum: 1, name: 'Notes Section' },
          relationships: {
            passages: { data: [{ type: 'passage', id: 'p-note' }] },
          },
        },
        passage: {
          id: 'p-note',
          attributes: {
            sequencenum: 1,
            reference: 'NOTE|Devotional Note',
            book: '',
          },
          relationships: {
            sharedResource: { data: { type: 'sharedresource', id: 'sr-1' } },
          },
        },
        extraMemoryRecords: {
          'passage:p-note': {
            id: 'p-note',
            attributes: {
              sequencenum: 1,
              reference: 'NOTE|Devotional Note',
              book: '',
            },
            relationships: {
              sharedResource: { data: { type: 'sharedresource', id: 'sr-1' } },
            },
          },
          'sharedresource:sr-1': {
            id: 'sr-1',
            attributes: { title: 'My Devotional Title' },
          },
        },
      });

      cy.get('[data-cy="workflow-step-label"]').should(
        'contain.text',
        'Notes Section'
      );
      cy.get('[data-cy="workflow-step-label"]').should(
        'contain.text',
        'My Devotional Title'
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
