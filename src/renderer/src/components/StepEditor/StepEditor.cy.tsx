import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import Memory from '@orbit/memory';
import Coordinator from '@orbit/coordinator';
import bugsnagClient from '../../auth/bugsnagClient';
import localizationReducer from '../../store/localization/reducers';
import { GlobalProvider, GlobalState } from '../../context/GlobalContext';
import { UnsavedProvider } from '../../context/UnsavedContext';
import DataProvider from '../../hoc/DataProvider';
import BigDialog from '../../hoc/BigDialog';
import { BigDialogBp } from '../../hoc/BigDialogBp';
import { StepEditor } from './StepEditor';

const TEST_ORG_ID = 'test-org-workflow';

const defaultDiscussTool = JSON.stringify({ tool: 'discuss', settings: '' });

type MockOrgWfAttrs = {
  id: string;
  name: string;
  sequencenum: number;
  process?: string;
  tool?: string;
};

const createWorkflowStepMemory = (
  orgId: string,
  stepDefs: MockOrgWfAttrs[]
): Memory => {
  const steps = stepDefs.map((s) => ({
    id: s.id,
    type: 'orgworkflowstep',
    attributes: {
      name: s.name,
      sequencenum: s.sequencenum,
      process: s.process ?? 'draft',
      tool: s.tool ?? defaultDiscussTool,
      permissions: '{}',
    },
    relationships: {
      organization: { data: { type: 'organization', id: orgId } },
    },
    keys: { remoteId: `remote-${s.id}` },
  }));

  /** Orbit-style terminal: supports `.filter(fn)` and `.filter({ attribute, value })` (see useArtifactType getTypeId). */
  const artifactTypeRecords = (_records: unknown[] = []) => {
    const records = _records;
    return {
      filter: (spec: unknown) => {
        if (typeof spec === 'function') {
          return records.filter(spec as (r: unknown) => boolean);
        }
        if (
          spec &&
          typeof spec === 'object' &&
          'attribute' in spec &&
          'value' in spec
        ) {
          const s = spec as { attribute: string; value: string };
          return records.filter(
            (r: unknown) =>
              (r as { attributes?: Record<string, string> }).attributes?.[
                s.attribute
              ] === s.value
          );
        }
        return records;
      },
    };
  };

  const createMockQueryBuilder = () => ({
    findRecord: ({ type, id }: { type: string; id: string }) => {
      if (type === 'orgworkflowstep') {
        return steps.find((x) => x.id === id);
      }
      return undefined;
    },
    findRecords: (type: string) => {
      if (type === 'orgworkflowstep') return steps;
      if (type === 'workflowstep') return [];
      if (type === 'artifacttype') return artifactTypeRecords([]);
      return [];
    },
  });

  return {
    cache: {
      query: (queryFn: (q: unknown) => unknown) =>
        queryFn(createMockQueryBuilder()),
      liveQuery: (queryFn: (q: unknown) => unknown) => ({
        subscribe: () => () => {},
        query: () => queryFn(createMockQueryBuilder()),
      }),
    },
    update: cy.stub(),
    keyMap: {
      idToKey: (_t: string, _a: string, localId: string) => localId,
      keyToId: (_t: string, _a: string, remoteId: string) => remoteId,
    },
  } as unknown as Memory;
};

const mockCoordinatorFor = (memory: Memory): Coordinator =>
  ({
    getSource: (name?: string) => (name === 'remote' ? undefined : memory),
  }) as unknown as Coordinator;

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

const createInitialState = (memory: Memory): GlobalState => ({
  coordinator: mockCoordinatorFor(memory),
  errorReporter: bugsnagClient,
  fingerprint: 'test-fingerprint',
  memory,
  lang: 'en',
  latestVersion: '',
  loadComplete: false,
  offlineOnly: false,
  organization: TEST_ORG_ID,
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
});

function StepEditorInDialog({ org }: { org: string }) {
  const [open, setOpen] = useState(true);
  return (
    <BigDialog
      title="Edit Workflow — Test"
      isOpen={open}
      onOpen={setOpen}
      bp={BigDialogBp.md}
    >
      <StepEditor org={org} />
    </BigDialog>
  );
}

const mountStepEditor = (memory: Memory) => {
  const initialState = createInitialState(memory);
  cy.mount(
    <Provider store={mockStore}>
      <GlobalProvider init={initialState}>
        <DataProvider dataStore={memory}>
          <UnsavedProvider>
            <StepEditorInDialog org={TEST_ORG_ID} />
          </UnsavedProvider>
        </DataProvider>
      </GlobalProvider>
    </Provider>
  );
};

describe('StepEditor (Edit Workflow)', () => {
  it('loads org workflow steps and shows the top Add control', () => {
    const memory = createWorkflowStepMemory(TEST_ORG_ID, [
      { id: 'wfs-1', name: 'Alpha Stage', sequencenum: 0 },
      { id: 'wfs-2', name: 'Beta Stage', sequencenum: 1 },
    ]);
    mountStepEditor(memory);
    cy.get('.MuiDialogContent-root input#stepName')
      .eq(0)
      .should('have.value', 'Alpha Stage');
    cy.get('.MuiDialogContent-root input#stepName')
      .eq(1)
      .should('have.value', 'Beta Stage');
    cy.get('#wk-step-add').should('be.visible');
  });

  it('top Add appends new steps', () => {
    const memory = createWorkflowStepMemory(TEST_ORG_ID, [
      { id: 'wfs-1', name: 'Only Stage', sequencenum: 0 },
    ]);
    mountStepEditor(memory);
    cy.get('#wk-step-add').click();
    cy.get('input').should('have.length.at.least', 2);
    cy.get('#wk-step-add').click();
    cy.get('input').should('have.length.at.least', 3);
  });

  it('keeps the sticky toolbar in view when dialog content is scrolled', () => {
    const many = Array.from({ length: 18 }, (_, i) => ({
      id: `wfs-${i}`,
      name: `Long List Step ${i}`,
      sequencenum: i,
    }));
    const memory = createWorkflowStepMemory(TEST_ORG_ID, many);
    cy.viewport(900, 420);
    mountStepEditor(memory);
    cy.get('.MuiDialogContent-root')
      .should('be.visible')
      .then(($el) => {
        $el[0].scrollTop = $el[0].scrollHeight;
      });
    cy.get('.MuiDialogContent-root').then(($content) => {
      const contentRect = $content[0].getBoundingClientRect();
      cy.get('#wk-step-add').then(($btn) => {
        const btnRect = $btn[0].getBoundingClientRect();
        expect(btnRect.top).to.be.at.least(contentRect.top - 1);
        expect(btnRect.top).to.be.at.most(contentRect.top + 8);
        expect(btnRect.bottom).to.be.at.most(contentRect.bottom);
      });
    });
  });

  it('scrolls so the new step is in view after Add when the list overflows', () => {
    const many = Array.from({ length: 32 }, (_, i) => ({
      id: `wfs-${i}`,
      name: `Scroll Test Step ${i}`,
      sequencenum: i,
    }));
    const memory = createWorkflowStepMemory(TEST_ORG_ID, many);
    cy.viewport(900, 320);
    mountStepEditor(memory);
    cy.get('.MuiDialogContent-root').should('be.visible').as('dlgContent');
    cy.get('@dlgContent').then(($el) => {
      $el[0].scrollTop = 0;
    });
    cy.get('#wk-step-add').click();
    cy.get('#wk-step-list-end-anchor').then(($anchor) => {
      cy.get('.MuiDialogContent-root').then(($content) => {
        const cr = $content[0].getBoundingClientRect();
        const ar = $anchor[0].getBoundingClientRect();
        expect(ar.bottom).to.be.at.most(cr.bottom + 2);
        expect(ar.top).to.be.at.least(cr.top - 2);
      });
    });
    cy.get('.MuiDialogContent-root input#stepName').last().should('be.visible');
  });
});
