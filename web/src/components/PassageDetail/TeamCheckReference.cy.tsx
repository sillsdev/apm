import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import LocalizedStrings from 'react-localization';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../auth/bugsnagClient';
import { GlobalProvider, GlobalState } from '../../context/GlobalContext';
import { OrbitContext } from '../../hoc/OrbitContextProvider';
import {
  PassageDetailContext,
  ICtxState,
} from '../../context/PassageDetailContext';
import { PassageD, SectionD } from '../../model';
import { ReferenceText } from '../../business/referenceText/referenceText';
import {
  clearChapterCache,
  HELLOAO_API,
} from '../../business/referenceText/referenceTextChapters';
import jhn3 from '../../business/referenceText/__fixtures__/BSB_JHN_3.simple.json';
import { TeamCheckReference } from './TeamCheckReference';

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

const bsb: ReferenceText = {
  id: 'BSB',
  name: 'Berean Standard Bible',
  englishName: 'Berean Standard Bible',
  language: 'eng',
  textDirection: 'ltr',
  license: '',
  books: 'JHN',
};

const mockStore = createStore(
  combineReducers({
    strings: () => ({
      loaded: true,
      lang: 'en',
      teamCheckReference: new LocalizedStrings({
        en: {
          resource: 'Resource',
          resourcehelper: 'Scripture or Bible Story Resource',
        },
      }),
      vProject: new LocalizedStrings({
        en: {
          primaryReferenceText: 'Primary Reference Text',
          secondaryReferenceText: 'Secondary Reference Text',
          licenseNotStated: 'License not stated',
        },
      }),
      passageDetailArtifacts: new LocalizedStrings({
        en: {
          referenceTextLoading: 'Loading passage…',
          referenceTextNoVoice: 'No voice for {0} on this device.',
          referenceTextSpeakFailed: 'The passage could not be spoken.',
        },
      }),
      mediaActions: new LocalizedStrings({
        en: { play: 'Play', pause: 'Pause', stop: 'Stop', view: 'View' },
      }),
      peerCheck: new LocalizedStrings({ en: { reference: 'Reference' } }),
      artifactCategory: new LocalizedStrings({
        en: { scripture: 'Scripture' },
      }),
      shared: new LocalizedStrings({ en: { close: 'Close' } }),
    }),
    books: () => ({ bookData: [] }),
  })
);

const mount = () => {
  const memory = createMockMemory({
    project: [
      {
        id: 'proj-1',
        type: 'project',
        attributes: {
          defaultParams: JSON.stringify({ referenceTexts: [bsb] }),
        },
      },
    ],
  });
  const orbitCache = new Map<string, any[]>();
  const initialState = {
    coordinator: { getSource: () => memory } as unknown as Coordinator,
    errorReporter: bugsnagClient,
    memory,
    project: 'proj-1',
    organization: 'org-1',
    user: 'user-1',
    connected: true,
    offline: false,
    offlineOnly: false,
    snackMessage: (<></>) as React.JSX.Element,
  } as GlobalState;
  const setPlayItem = cy.stub().as('setPlayItem');
  const ctxState = {
    rowData: [],
    playItem: '',
    setPlayItem,
    setMediaSelected: cy.stub(),
    itemPlaying: false,
    handleItemPlayEnd: cy.stub(),
    handleItemTogglePlay: cy.stub(),
    section: { id: 'section-1', type: 'section' } as SectionD,
    passage: {
      id: 'passage-1',
      type: 'passage',
      attributes: { book: 'JHN', reference: '3:1-2', sequencenum: 1 },
    } as PassageD,
    currentstep: 'compare-step',
    // Speaking stops other passage playback
    setPlaying: cy.stub(),
    setItemPlaying: cy.stub(),
    setCommentPlaying: cy.stub(),
    handleOldVernacularPlayEnd: cy.stub(),
  } as unknown as ICtxState; // only what Compare reads

  cy.mount(
    <Provider store={mockStore}>
      <GlobalProvider init={initialState}>
        <OrbitContext.Provider
          value={{
            memory,
            getRecs: (type: string) => orbitCache.get(type),
            setRecs: (type: string, recs: any[] | undefined) => {
              if (recs === undefined) orbitCache.delete(type);
              else orbitCache.set(type, recs);
            },
          }}
        >
          <PassageDetailContext.Provider
            value={{ state: ctxState, setState: cy.stub() }}
          >
            <TeamCheckReference />
          </PassageDetailContext.Provider>
        </OrbitContext.Provider>
      </GlobalProvider>
    </Provider>
  );
};

describe('TeamCheckReference', () => {
  beforeEach(() => {
    clearChapterCache();
    localStorage.clear();
  });

  // TT-7819: the project's Reference Text can be reviewed on Compare along
  // with the audio resources.
  it('TT-7819: picks the Primary Reference Text and shows it when no voice speaks it', () => {
    cy.intercept('GET', `${HELLOAO_API}/BSB/JHN/3.simple.json`, {
      body: jhn3,
    });
    mount();
    // Only a voice for another language, so the result doesn't depend on the machine
    cy.window().then((win) => {
      cy.stub(win.speechSynthesis, 'getVoices').returns([
        { lang: 'xx-XX', name: 'None', default: true, localService: true },
      ]);
    });
    cy.get('#select-my-resource').click();
    cy.get('[role="listbox"]')
      .contains(
        '[role="option"]',
        'Primary Reference Text — Berean Standard Bible'
      )
      .click();
    cy.get('@setPlayItem').should(
      'not.have.been.calledWith',
      'referenceText:primary'
    );
    cy.get('[data-cy="compare-reference-text-primary"]')
      .find('button[aria-label="Play"]')
      .click();
    cy.get('[role="dialog"]')
      .should('contain.text', 'No voice for English on this device.')
      .and('contain.text', 'Now there was a man of the Pharisees');
  });
});
