import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';

import bugsnagClient from '../../../../auth/bugsnagClient';
import { GlobalProvider, GlobalState } from '../../../../context/GlobalContext';
import { IOrbitContext } from '../../../../hoc/OrbitContext';
import { OrbitContext } from '../../../../hoc/OrbitContextProvider';
import { UnsavedContext } from '../../../../context/UnsavedContext';
import { PassageDetailContext } from '../../../../context/PassageDetailContext';
import { HotKeyContext } from '../../../../context/HotKeyContext';

import localizationReducer from '../../../../store/localization/reducers';
import bookReducer from '../../../../store/book/reducers';
import { Organization } from '../../../../model';
import { IVoicePerm } from '../../../../business/voice/PersonalizeVoicePermission';
import { voicePermOpts } from '../../../../business/voice/voicePermOpts';

import ProvideRightsMobile from './ProvideRightsMobile';

type RecordsByType = Record<string, unknown[]>;

const createMockQueryBuilder = (recordsByType: RecordsByType) => ({
  findRecords: (type: string) => {
    const base = [...(recordsByType[type] ?? [])] as any[];
    const origFilter = base.filter.bind(base);
    base.filter = (arg: any) => {
      if (typeof arg === 'function') return origFilter(arg);
      if (arg && typeof arg === 'object' && 'attribute' in arg) {
        const { attribute, value } = arg as { attribute: string; value: any };
        return origFilter((rec: any) => rec?.attributes?.[attribute] === value);
      }
      return origFilter(() => true);
    };
    return base;
  },
  findRecord: (identity: { type: string; id: string }) =>
    (recordsByType[identity.type] ?? []).find(
      (rec) => (rec as { id: string }).id === identity.id
    ),
});

const createMockMemory = (recordsByType: RecordsByType): Memory =>
  ({
    cache: {
      query: (queryFn: (q: unknown) => unknown) =>
        queryFn(createMockQueryBuilder(recordsByType)),
      liveQuery: (queryFn: (q: unknown) => unknown) => ({
        subscribe: () => () => {},
        query: () => queryFn(createMockQueryBuilder(recordsByType)),
      }),
    },
    update: () => {},
    keyMap: {
      idToKey: (_table: string, _attr: string, localId: string) => localId,
      keyToId: (_table: string, _attr: string, remoteId: string) => remoteId,
    },
  }) as unknown as Memory;

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
    books: bookReducer,
  })
);

const createInitialState = (
  memory: Memory,
  overrides: Partial<GlobalState> = {}
): GlobalState => ({
  coordinator: {
    getSource: (name: string) => {
      if (name === 'memory') return memory;
      return {} as unknown;
    },
  } as unknown as Coordinator,
  errorReporter: bugsnagClient,
  fingerprint: 'test-fingerprint',
  memory,
  lang: 'en',
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
  plan: 'plan-1',
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

describe('ProvideRightsMobile', () => {
  const mountProvideRightsMobile = (
    props: Partial<React.ComponentProps<typeof ProvideRightsMobile>> & {
      globalOverrides?: Partial<GlobalState>;
    } = {}
  ) => {
    const {
      globalOverrides,
      paperRef = React.createRef<HTMLDivElement | null>(),
      ...componentProps
    } = props;

    const memory = createMockMemory({
      organization: [
        {
          id: 'org-1',
          type: 'organization',
          attributes: {
            name: 'Test Org',
            defaultParams: JSON.stringify({ permissions: false }),
          },
        },
      ],
      plan: [
        {
          id: 'plan-1',
          type: 'plan',
          attributes: { slug: 'test', flat: false },
        },
      ],
      section: [
        {
          id: 'sec-1',
          type: 'section',
          attributes: { sequencenum: 1, name: 'Section 001' },
          relationships: { plan: { data: { type: 'plan', id: 'plan-1' } } },
        },
      ],
    });

    const orbitCache = new Map<string, unknown[]>();
    const orbitContextValue: IOrbitContext = {
      memory,
      getRecs: (type: string) => orbitCache.get(type) as any,
      setRecs: (type: string, recs: any[] | undefined) => {
        if (recs === undefined) orbitCache.delete(type);
        else orbitCache.set(type, recs);
      },
    };

    const unsavedState = {
      startSave: cy.stub(),
      toolChanged: cy.stub(),
      toolsChanged: {},
      saveRequested: () => false,
      clearRequested: () => false,
      clearCompleted: cy.stub(),
      waitForSave: (_cb: () => void) => {},
      saveCompleted: cy.stub(),
    };

    const passage = {
      id: 'pass-1',
      type: 'passage',
      attributes: {
        sequencenum: 1,
        reference: 'JHN 1:1',
        book: 'JHN',
        startChapter: 1,
        endChapter: 1,
        startVerse: 1,
        endVerse: 1,
        title: 'Test Passage',
      },
      relationships: {
        section: { data: { type: 'section', id: 'sec-1' } },
      },
    } as any;

    const ctxState = {
      passage,
      sharedResource: {} as any,
      mediafileId: '',
      chooserSize: 48,
      setRecording: cy.stub(),
      currentstep: '',
    };

    const theme = createTheme({
      palette: {
        custom: {
          currentRegion: 'rgba(0, 200, 0, 0.25)',
        },
      } as any,
    });

    cy.viewport(480, 800);

    const defaults: React.ComponentProps<typeof ProvideRightsMobile> = {
      paperRef,
      paperProps: {},
      paperWidth: 500,
      rowProp: {},
      statusProps: {},
      statusText: 'Ready to save',
      canSave: true,
      recordingRequired: false,
      handleUpload: cy.stub().as('handleUpload'),
      handleLater: cy.stub().as('handleLater'),
      handleSave: cy.stub().as('handleSave'),
      state: mockVoicePerm(),
      setState: cy.stub().as('setState'),
      handleStatement: cy.stub().as('handleStatement'),
      busy: false,
      speaker: 'Jane Tester',
      teamRec: mockTeam,
      toolId: 'RightsTool',
      team: 'org-1',
      defaultFilename: 'rights.wav',
      artifactState: { id: 'art-1' },
      setSaving: cy.stub().as('setSaving'),
      setStatusText: cy.stub().as('setStatusText'),
      setResetMedia: cy.stub().as('setResetMedia'),
      resetMedia: false,
      afterUploadCb: cy.stub().as('afterUploadCb'),
      handleSetCanSave: cy.stub().as('handleSetCanSave'),
    };

    cy.mount(
      <Provider store={mockStore}>
        <ThemeProvider theme={theme}>
          <GlobalProvider init={createInitialState(memory, globalOverrides)}>
            <OrbitContext.Provider value={orbitContextValue}>
              <UnsavedContext.Provider
                value={{ state: unsavedState as any, setState: cy.stub() as any }}
              >
                <HotKeyContext.Provider
                  value={{
                    state: {
                      subscribe: () => {},
                      unsubscribe: () => {},
                      localizeHotKey: () => '',
                    } as any,
                    setState: cy.stub() as any,
                  }}
                >
                  <PassageDetailContext.Provider
                    value={{ state: ctxState as any, setState: cy.stub() as any }}
                  >
                    <ProvideRightsMobile {...defaults} {...componentProps} />
                  </PassageDetailContext.Provider>
                </HotKeyContext.Provider>
              </UnsavedContext.Provider>
            </OrbitContext.Provider>
          </GlobalProvider>
        </ThemeProvider>
      </Provider>
    ).then(() => {
      cy.window().then((win) => {
        win.dispatchEvent(new Event('resize'));
      });
    });
  };

  it('renders voice statement, status text, later, and save', () => {
    mountProvideRightsMobile();

    cy.get('[data-cy="provide-rights-mobile"]').should('be.visible');
    cy.get('[data-cy="voice-statement-text"]')
      .should('be.visible')
      .and('contain', 'Jane Tester');
    cy.get('[data-cy="provide-rights-status"]').should(
      'contain',
      'Ready to save'
    );
    cy.contains('Do later').should('be.visible');
    cy.get('#spkr-save').should('be.visible').and('contain', 'Save');
  });

  it('hides later when recording is required', () => {
    mountProvideRightsMobile({ recordingRequired: true });

    cy.get('#spkr-later').should('not.exist');
  });

  it('hides save when canSave is false', () => {
    mountProvideRightsMobile({ canSave: false });

    cy.get('#spkr-save').should('not.exist');
  });

  it('disables save when voice permission state is invalid', () => {
    mountProvideRightsMobile({ state: mockVoicePerm({ valid: false }) });

    cy.get('#spkr-save').should('be.disabled');
  });

  it('calls handleLater when later is clicked', () => {
    mountProvideRightsMobile();

    cy.contains('Do later').click();
    cy.get('@handleLater').should('have.been.calledOnce');
  });

  it('calls handleSave when save is clicked (enabled)', () => {
    mountProvideRightsMobile();

    cy.get('#spkr-save').click();
    cy.get('@handleSave').should('have.been.calledOnce');
  });

  it('shows busy progress while saving', () => {
    mountProvideRightsMobile({ busy: true });

    cy.get('[data-cy="provide-rights-busy"]').should('be.visible');
    cy.get('[data-cy="provide-rights-busy"]').within(() => {
      cy.contains('Loading:').should('be.visible');
      cy.get('.MuiLinearProgress-root').should('exist');
    });
  });
});
