/**
 * Sections & Passages save integration tests — TT-7416 / TT-6918 / TT-6919
 */
import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../auth/bugsnagClient';
import { GlobalProvider, GlobalState } from '../../context/GlobalContext';
import { UnsavedProvider } from '../../context/UnsavedContext';
import DataProvider from '../../hoc/DataProvider';
import localizationReducer from '../../store/localization/reducers';
import { schema } from '../../schema';
import { SheetSaveHarness } from './SheetSaveHarness';
import {
  installSheetSaveRemoteMock,
  SheetSaveMockMode,
} from '../../../cypress/support/sheetSaveMocks';
import { resetUseGlobalModuleState } from '../../context/useGlobal';

const mockStore = createStore(
  combineReducers({
    strings: () => {
      const initialState = localizationReducer(undefined, { type: '@@INIT' });
      return { ...initialState, loaded: true, lang: 'en' };
    },
  })
);

const theme = createTheme();

const createMockMemory = (): Memory =>
  ({
    cache: {
      query: (fn: (q: unknown) => unknown) =>
        fn({
          findRecords: (type: string) =>
            type === 'plan'
              ? [
                  {
                    id: 'plan-local-1',
                    type: 'plan',
                    attributes: { organizedBy: 'section' },
                  },
                ]
              : [],
          findRecord: () => undefined,
        }),
      liveQuery: () => ({
        subscribe: () => () => {},
        query: () => [],
      }),
    },
    update: async () => null,
    sync: async () => {},
    keyMap: { idToKey: () => undefined, keyToId: () => undefined },
    schema,
  }) as unknown as Memory;

const mountHarness = (
  mockMode: SheetSaveMockMode,
  props: Partial<React.ComponentProps<typeof SheetSaveHarness>> = {},
  mockOpts: { delayMs?: number } = {}
) => {
  const memory = createMockMemory();
  const backup = { sync: async () => {} };
  installSheetSaveRemoteMock(memory, { mode: mockMode, ...mockOpts });

  const globals = {
    coordinator: {
      getSource: (name: string) => {
        if (name === 'backup') return backup;
        return memory;
      },
    } as unknown as Coordinator,
    errorReporter: bugsnagClient,
    fingerprint: 'test-fingerprint',
    memory,
    latestVersion: '',
    loadComplete: false,
    offlineOnly: false,
    organization: 'org-1',
    releaseDate: '',
    user: 'user-1',
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
    plan: 'plan-local-1',
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
    mobileView: true,
  } as GlobalState;

  cy.mount(
    <Provider store={mockStore}>
      <ThemeProvider theme={theme}>
        <GlobalProvider init={globals}>
          <DataProvider dataStore={memory}>
            <UnsavedProvider>
              <SheetSaveHarness {...props} />
            </UnsavedProvider>
          </DataProvider>
        </GlobalProvider>
      </ThemeProvider>
    </Provider>
  );
};

const pasteLukeAndWaitForSave = () => {
  cy.get('#sheetPasteTrigger').click();
  cy.get('[data-testid="sheet-row"]', { timeout: 10000 }).should(
    'have.length.at.least',
    1
  );
  cy.get('#planSheetSave', { timeout: 10000 })
    .should('not.be.disabled')
    .click();
};

describe('ScriptureTable save RED', () => {
  beforeEach(() => {
    resetUseGlobalModuleState();
    (window as unknown as { __navCalled?: boolean }).__navCalled = false;
  });

  it('TT-7416: paste hierarchical save hangs with broken keyMap', () => {
    mountHarness('brokenKeyMap');
    pasteLukeAndWaitForSave();
    cy.window()
      .its('__APM_TEST__.remoteBusy', { timeout: 15000 })
      .should('eq', true);
  });

  it('TT-6918: delete-all paste genesis save fails on removeRecord sync', () => {
    mountHarness('deleteSyncFails', {
      preloadPopulated: true,
      pasteGenesis: true,
    });
    cy.get('#sheetDeleteAll').click();
    pasteLukeAndWaitForSave();
    cy.window()
      .its('__APM_TEST__.remoteBusy', { timeout: 15000 })
      .should('eq', true);
  });
});

describe('ScriptureTable save GREEN', () => {
  beforeEach(() => {
    resetUseGlobalModuleState();
    (window as unknown as { __navCalled?: boolean }).__navCalled = false;
  });

  it('TT-7416: paste hierarchical and save completes', () => {
    mountHarness('happyPath');
    pasteLukeAndWaitForSave();
    cy.window()
      .its('__APM_TEST__.remoteBusy', { timeout: 15000 })
      .should('eq', false);
    cy.window().its('__APM_TEST__.changed').should('eq', false);
    cy.window().its('__APM_TEST__.progress').should('eq', 0);
    cy.get('[data-testid="sheet-row"]')
      .first()
      .should('have.attr', 'data-section-id')
      .and('not.eq', '');
  });

  it('TT-6918: delete-all, paste genesis, save without error', () => {
    mountHarness('happyPath', {
      preloadPopulated: true,
      pasteGenesis: true,
    });
    cy.get('#sheetDeleteAll').click();
    pasteLukeAndWaitForSave();
    cy.get('#loadErrLogout').should('not.exist');
    cy.window()
      .its('__APM_TEST__.remoteBusy', { timeout: 15000 })
      .should('eq', false);
  });

  it('TT-6919: slow save blocks navigation until complete', () => {
    mountHarness(
      'slowDataChanges',
      { preloadPopulated: false },
      { delayMs: 800 }
    );
    pasteLukeAndWaitForSave();
    cy.get('#testNavigateHome').click();
    cy.window().its('__navCalled').should('eq', false);
    cy.window()
      .its('__APM_TEST__.remoteBusy', { timeout: 15000 })
      .should('eq', false);
    cy.window().its('__navCalled').should('eq', true);
  });

  it('TT-6919: reload after completed save shows no error splash', () => {
    mountHarness('happyPath', { preloadPopulated: true });
    cy.get('#sheetDeleteAll').click();
    cy.get('#planSheetSave', { timeout: 10000 })
      .should('not.be.disabled')
      .click();
    cy.window()
      .its('__APM_TEST__.remoteBusy', { timeout: 15000 })
      .should('eq', false);
    cy.get('#loadErrLogout').should('not.exist');
  });
});
