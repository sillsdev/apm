import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import { UninitializedRecord } from '@orbit/records';
import bugsnagClient from '../../../../auth/bugsnagClient';
import { GlobalProvider, GlobalState } from '../../../../context/GlobalContext';
import { IOrbitContext } from '../../../../hoc/OrbitContext';
import { OrbitContext } from '../../../../hoc/OrbitContextProvider';
import localizationReducer from '../../../../store/localization/reducers';
import { PassageTypeEnum } from '../../../../model';
import PlayCell from '../../../AudioTab/PlayCell';
import { IRow } from '../../../AudioTab';
import { AudioVersionCard } from './AudioVersionCard';

type RecordsByType = Record<string, unknown[]>;

const createMockQueryBuilder = (recordsByType: RecordsByType) => ({
  findRecords: (type: string) => recordsByType[type] ?? [],
  findRecord: (identity: { type: string; id: string }) =>
    (recordsByType[identity.type] ?? []).find((rec) => (rec as { id: string }).id === identity.id),
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

const mockCoordinator = {
  getSource: () => createMockMemory({}),
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
  memory: Memory,
  overrides: Partial<GlobalState> = {}
): GlobalState => ({
  coordinator: mockCoordinator,
  errorReporter: bugsnagClient,
  fingerprint: 'test-fingerprint',
  memory,
  lang: 'en',
  latestVersion: '',
  loadComplete: false,
  offlineOnly: false,
  organization: 'test-org',
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

const createMockRow = (overrides: Partial<IRow> = {}): IRow => ({
  index: 0,
  planid: 'plan-1',
  passId: 'pass-1',
  id: 'media-1',
  planName: 'Plan',
  playIcon: '',
  fileName: 'recording.wav',
  sectionId: 'sec-1',
  sectionDesc: '',
  reference: 'JHN 1:1',
  referenceString: 'JHN 1:1',
  duration: '0:42',
  size: 2 * 1024 * 1024,
  version: '1',
  date: '2020-06-15T14:30:00.000Z',
  readyToShare: false,
  publishTo: '',
  passageType: PassageTypeEnum.PASSAGE,
  user: 'user-1',
  actions: PlayCell,
  ...overrides,
});

describe('AudioVersionCard', () => {
  const mountCard = (
    props: Partial<React.ComponentProps<typeof AudioVersionCard>> & {
      recordsByType?: RecordsByType;
    } = {}
  ) => {
    const {
      recordsByType = {
        user: [
          {
            id: 'user-1',
            type: 'user',
            attributes: {
              name: 'Alex Recorder',
              familyName: 'Recorder',
              avatarUrl: null,
            },
          },
        ],
      },
      ...cardProps
    } = props;

    const memory = createMockMemory(recordsByType);
    const orbitCache = new Map<string, UninitializedRecord[]>();
    const orbitContextValue: IOrbitContext = {
      memory,
      getRecs: (type: string) => orbitCache.get(type),
      setRecs: (type: string, recs: UninitializedRecord[] | undefined) => {
        if (recs === undefined) orbitCache.delete(type);
        else orbitCache.set(type, recs);
      },
    };

    const theme = createTheme();
    cy.viewport(480, 800);

    cy.mount(
      <Provider store={mockStore}>
        <ThemeProvider theme={theme}>
          <GlobalProvider init={createInitialState(memory)}>
            <OrbitContext.Provider value={orbitContextValue}>
              <AudioVersionCard
                isSelected={false}
                setIsSelected={cy.stub().as('setIsSelected')}
                lang="en"
                handleSelect={cy.stub().as('handleSelect')}
                playItem=""
                mediaPlaying={false}
                {...createMockRow()}
                {...cardProps}
              />
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

  it('renders file metadata, reference, duration, size, and date', () => {
    mountCard();

    cy.get('[data-cy="audio-version-file-name"]').should(
      'contain',
      'recording.wav'
    );
    cy.contains('JHN 1:1').should('be.visible');
    cy.contains('0:42').should('be.visible');
    cy.contains('2.00 MB').should('be.visible');
    cy.contains('6/15/2020').should('be.visible');
  });

  it('shows an avatar for the current user from Orbit data', () => {
    mountCard();

    // useAvatarSource resolves asynchronously; UserAvatar may show #abbruser first or
    // #srcuser after dataPath settles. Assert on a stable wrapper with a longer timeout
    // so the first attempt passes under runMode retries (see cypress/config/base.config.ts).
    cy.get('[data-cy="audio-version-card"] .MuiAvatar-root', {
      timeout: 10000,
    })
      .should('be.visible')
      .and(($avatar) => {
        const text = $avatar.text().trim();
        const alt =
          $avatar.find('img').attr('alt') ?? $avatar.attr('alt') ?? '';
        expect(
          text.includes('AR') || alt.includes('Alex Recorder'),
          'initials or user name on avatar'
        ).to.eq(true);
      });
  });

  it('calls setIsSelected with the media id when the card body is clicked', () => {
    mountCard();

    cy.get('[data-cy="audio-version-file-name"]').click({ force: true });
    cy.get('@setIsSelected').should('have.been.calledWith', 'media-1');
  });

  it('calls handleSelect when the play control is clicked', () => {
    mountCard();

    cy.get('#audActPlayStop').click();
    cy.get('@handleSelect').should('have.been.calledWith', 'media-1');
  });

  it('uses pause label and title when this row is the active playing item', () => {
    mountCard({
      playItem: 'media-1',
      mediaPlaying: true,
    });

    cy.get('#audActPlayStop').should('have.attr', 'title', 'Pause');
  });

  it('uses play label when this row is not the active playing item', () => {
    mountCard({
      playItem: 'other-id',
      mediaPlaying: true,
    });

    cy.get('#audActPlayStop').should('have.attr', 'title', 'Play');
  });

  it('disables the play control when the media id is empty', () => {
    mountCard({ id: '' });

    cy.get('#audActPlayStop').should('be.disabled');
  });

  it('applies selected background styling when isSelected is true', () => {
    mountCard({ isSelected: true });

    cy.get('[data-cy="audio-version-card"]').should(
      'have.css',
      'background-color',
      'rgb(173, 216, 230)'
    );
  });
});
