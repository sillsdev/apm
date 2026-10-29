import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import LocalizedStrings from 'react-localization';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import bugsnagClient from '../../../auth/bugsnagClient';
import { GlobalProvider, GlobalState } from '../../../context/GlobalContext';
import { OrbitContext } from '../../../hoc/OrbitContextProvider';
import {
  PassageDetailContext,
  ICtxState,
} from '../../../context/PassageDetailContext';
import { PassageD } from '../../../model';
import { ReferenceText } from '../../../business/referenceText/referenceText';
import {
  clearChapterCache,
  HELLOAO_API,
} from '../../../business/referenceText/referenceTextChapters';
import jhn3 from '../../../business/referenceText/__fixtures__/BSB_JHN_3.simple.json';
import { ReferenceTextRows } from './ReferenceTextRows';

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
// Its chapters are never served, so it stays loading
const arabic: ReferenceText = {
  id: 'arb_vdv',
  name: 'الكتاب المقدس',
  englishName: 'Arabic Van Dyke',
  language: 'arb',
  textDirection: 'rtl',
  license: 'Public Domain',
  licenseUrl: 'https://example.org/pd',
  books: 'JHN',
};

const mockStore = createStore(
  combineReducers({
    strings: () => ({
      loaded: true,
      lang: 'en',
      vProject: new LocalizedStrings({
        en: {
          primaryReferenceText: 'Primary Reference Text',
          secondaryReferenceText: 'Secondary Reference Text',
          licenseNotStated: 'License not stated',
        },
      }),
      passageDetailArtifacts: new LocalizedStrings({
        en: {
          passageResource: 'Passage',
          referenceTextBookMissing: 'This Bible does not include this book.',
          referenceTextEmpty: 'This Bible has no text for these verses.',
          referenceTextFetchFailed: 'The passage could not be loaded.',
          referenceTextLoading: 'Loading passage…',
          referenceTextNoRange: 'This passage has no verse range.',
          referenceTextNoVoice: 'No voice for {0} on this device.',
          referenceTextRetry: 'Try again',
          referenceTextSpeakFailed: 'The passage could not be spoken.',
        },
      }),
      mediaActions: new LocalizedStrings({
        en: { play: 'Play', pause: 'Pause', stop: 'Stop', view: 'View' },
      }),
      shared: new LocalizedStrings({ en: { close: 'Close' } }),
    }),
    books: () => ({ bookData: [] }),
  })
);

const mount = (variant: 'table' | 'card', texts: ReferenceText[]) => {
  const memory = createMockMemory({
    project: [
      {
        id: 'proj-1',
        type: 'project',
        attributes: {
          defaultParams: JSON.stringify({ referenceTexts: texts }),
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
  const ctxState = {
    passage: {
      id: 'passage-1',
      type: 'passage',
      attributes: { book: 'JHN', reference: '3:1-2' },
    } as PassageD,
    // Speaking stops other passage playback
    setPlaying: cy.stub(),
    setItemPlaying: cy.stub(),
    setCommentPlaying: cy.stub(),
    handleOldVernacularPlayEnd: cy.stub(),
  } as ICtxState;

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
            <ReferenceTextRows variant={variant} />
          </PassageDetailContext.Provider>
        </OrbitContext.Provider>
      </GlobalProvider>
    </Provider>
  );
};

const serveJohn3 = () =>
  cy.intercept('GET', `${HELLOAO_API}/BSB/JHN/3.simple.json`, {
    body: jhn3,
  });

describe('ReferenceTextRows', () => {
  beforeEach(() => clearChapterCache());

  it('lists Primary then Secondary and shows the Primary text when no voice speaks it', () => {
    serveJohn3();
    mount('table', [bsb, arabic]);
    // Only a voice for another language, so the result doesn't depend on the machine
    cy.window().then((win) => {
      cy.stub(win.speechSynthesis, 'getVoices').returns([
        { lang: 'xx-XX', name: 'None', default: true, localService: true },
      ]);
    });
    cy.get('[data-cy^="reference-text-"]').then((rows) => {
      expect(rows.toArray().map((r) => r.dataset.cy)).to.deep.equal([
        'reference-text-primary',
        'reference-text-secondary',
      ]);
    });
    cy.get('[data-cy="reference-text-secondary"]')
      .contains('الكتاب المقدس')
      .should('have.attr', 'dir', 'rtl');
    cy.get('[data-cy="reference-text-primary"]')
      .find('button[aria-label="Play"]')
      .click();
    cy.get('[role="dialog"]')
      .should('contain.text', 'No voice for English on this device.')
      .and('contain.text', 'Now there was a man of the Pharisees')
      .and('contain.text', 'License not stated');
  });

  it('retries a passage that could not be loaded', () => {
    cy.intercept('GET', `${HELLOAO_API}/BSB/JHN/3.simple.json`, {
      statusCode: 503,
    }).as('failed');
    mount('table', [bsb]);
    cy.wait('@failed');
    cy.contains('The passage could not be loaded.').should('be.visible');
    serveJohn3();
    cy.contains('button', 'Try again').click();
    cy.get('[data-cy="reference-text-primary"]')
      .find('button[aria-label="View"]')
      .click();
    cy.get('[role="dialog"]').should(
      'contain.text',
      'He came to Jesus at night'
    );
  });

  it('shows cards with the license link on mobile', () => {
    cy.viewport(390, 844);
    cy.intercept('GET', `${HELLOAO_API}/arb_vdv/JHN/3.simple.json`, {
      body: { ...jhn3, translation: { id: 'arb_vdv' } },
    });
    mount('card', [arabic]);
    cy.get('[data-cy="reference-text-primary"]')
      .should('contain.text', 'Primary Reference Text')
      .find('button[aria-label="View"]')
      .click();
    cy.get('[role="dialog"]')
      .contains('a', 'Public Domain')
      .should('have.attr', 'href', 'https://example.org/pd');
  });
});
