import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../auth/bugsnagClient';
import { GlobalProvider, GlobalState } from '../../context/GlobalContext';
import { Organization } from '../../model';
import localizationReducer from '../../store/localization/reducers';
import { VoiceStatement } from './VoiceStatement';
import { IVoicePerm } from './PersonalizeVoicePermission';
import { voicePermOpts } from './voicePermOpts';

describe('VoiceStatement', () => {
  const mockMemory = {
    cache: { query: () => [], liveQuery: () => () => {} },
    update: () => {},
  } as unknown as Memory;

  const mockCoordinator = {
    getSource: () => mockMemory,
  } as unknown as Coordinator;

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
    })
  );

  const createInitialState = (
    overrides: Partial<GlobalState> = {}
  ): GlobalState => ({
    coordinator: mockCoordinator,
    errorReporter: bugsnagClient,
    fingerprint: 'test-fingerprint',
    memory: mockMemory,
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

  const mockTeam: Organization = {
    id: 'org-1',
    type: 'organization',
    attributes: {
      name: 'Acme Team',
      slug: 'acme',
      silId: 0,
      description: null,
      websiteUrl: null,
      logoUrl: null,
      publicByDefault: false,
      clusterbase: false,
      dateCreated: '',
      dateUpdated: '',
      lastModifiedBy: 0,
      defaultParams: '{}',
    },
  };

  const mockVoicePerm = (overrides: Partial<IVoicePerm> = {}): IVoicePerm => ({
    fullName: 'Jane Tester',
    languages: '[]',
    hired: false,
    scope: voicePermOpts[0],
    valid: true,
    ...overrides,
  });

  const mountVoiceStatement = ({
    globalOverrides,
    viewport,
    ...props
  }: Partial<React.ComponentProps<typeof VoiceStatement>> & {
    globalOverrides?: Partial<GlobalState>;
    viewport?: { width: number; height: number };
  } = {}) => {
    const theme = createTheme();
    cy.viewport(viewport?.width ?? 1280, viewport?.height ?? 800);
    cy.mount(
      <Provider store={mockStore}>
        <ThemeProvider theme={theme}>
          <GlobalProvider init={createInitialState(globalOverrides)}>
            <VoiceStatement
              team={mockTeam}
              state={mockVoicePerm()}
              saving={false}
              {...props}
            />
          </GlobalProvider>
        </ThemeProvider>
      </Provider>
    ).then(() => {
      cy.window().then((win) => {
        win.dispatchEvent(new Event('resize'));
      });
    });
  };

  it('renders the permission statement from voice permission state', () => {
    mountVoiceStatement();

    cy.get('[data-cy="voice-statement-text"]')
      .should('be.visible')
      .and('contain', 'Jane Tester');
  });

  it('calls setStatement with the computed statement when permStatement updates', () => {
    const setStatement = cy.stub().as('setStatement');

    mountVoiceStatement({ setStatement });

    // `permStatement` can be empty on the first render; wait for the computed one.
    cy.get('[data-cy="voice-statement-text"]')
      .should('be.visible')
      .and('contain', 'Jane Tester');

    cy.get('@setStatement').should((stub) => {
      const spy = stub as unknown as sinon.SinonSpy;
      const calledWithJane = spy.args.some(
        (args) => typeof args?.[0] === 'string' && args[0].includes('Jane Tester')
      );
      expect(calledWithJane).to.eq(true);
    });
  });

  it('shows copy and personalize controls on desktop (non-mobile)', () => {
    mountVoiceStatement();

    cy.get('[data-cy="voice-statement-copy"]').should('be.visible');
    cy.get('[data-cy="voice-statement-personalize"]')
      .should('be.visible')
      .and('contain', 'Personalize');
  });

  it('hides copy and personalize when global mobile view is enabled', () => {
    mountVoiceStatement({
      globalOverrides: { mobileView: true },
      viewport: { width: 480, height: 800 },
    });

    cy.get('[data-cy="voice-statement-copy"]').should('not.exist');
    cy.get('[data-cy="voice-statement-personalize"]').should('not.exist');
    cy.get('[data-cy="voice-statement-text"]').should('be.visible');
  });

  it('copies the permission statement to the clipboard', () => {
    mountVoiceStatement();

    cy.window().then((win) => {
      cy.stub(win.navigator.clipboard, 'writeText').as('clipboardWrite');
    });

    cy.get('[data-cy="voice-statement-copy"]').click();

    cy.get('@clipboardWrite').then((stub) => {
      const clipboardWrite = stub as unknown as sinon.SinonSpy;
      expect(clipboardWrite).to.have.been.calledOnce;
      const text = clipboardWrite.args[0][0] as string;
      expect(text).to.include('Jane Tester');
    });
  });

  it('disables personalize while saving', () => {
    mountVoiceStatement({ saving: true });

    cy.get('[data-cy="voice-statement-personalize"]').should('be.disabled');
  });

  it('opens the personalize dialog and applies voice name to state when personalize is clicked', () => {
    const setState = cy.stub().as('setState');

    mountVoiceStatement({
      voice: 'Jane From Voice Prop',
      setState,
    });

    cy.get('[data-cy="voice-statement-personalize"]').click();

    cy.get('#bigDlg').should('contain', 'Personalize Voice Permission');
    cy.get('@setState').should('have.been.calledWith', {
      fullName: 'Jane From Voice Prop',
      languages: '[]',
      hired: false,
      scope: voicePermOpts[0],
      valid: true,
    });
  });

  it('closes the personalize dialog when cancel is clicked', () => {
    const setState = cy.stub().as('setState');

    mountVoiceStatement({ setState });

    cy.get('[data-cy="voice-statement-personalize"]').click();
    cy.get('#bigDlg').should('be.visible');

    cy.get('#bigCancel').click();

    cy.get('#bigDlg').should('not.exist');
    cy.get('@setState').should('have.been.called');
  });
});
