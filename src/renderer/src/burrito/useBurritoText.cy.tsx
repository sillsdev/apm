/// <reference types="cypress" />
import React, { useState } from 'react';
import { Provider } from 'react-redux';
import {
  applyMiddleware,
  combineReducers,
  legacy_createStore as createStore,
} from 'redux';
import { thunk } from 'redux-thunk';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import { GlobalProvider } from '../context/GlobalContext';
import DataProvider from '../hoc/DataProvider';
import bugsnagClient from '../auth/bugsnagClient';
import localizationReducer from '../store/localization/reducers';
import { schema, keyMap } from '../schema';
import { SectionD } from '../model';
import { useBurritoText } from './useBurritoText';
import { Burrito } from './data/types';

// TT-7716: real usfm-grammar parser (Jest mocks convertBurritoText). James
// passages shaped like QA's project: cross-chapter passages whose
// transcriptions embed \c, with and without \v markers.

type MockRec = {
  id: string;
  type: string;
  attributes: Record<string, unknown>;
  relationships?: Record<string, unknown>;
};

const TEAM_ID = 'team-one';
const USER_ID = 'test-user-id';
const PLAN_ID = 'plan-1';

const rel = (type: string, id: string) => ({ data: { type, id } });

const passage = (
  id: string,
  sequencenum: number,
  reference: string,
  [startChapter, startVerse, endChapter, endVerse]: number[]
): MockRec => ({
  id,
  type: 'passage',
  attributes: {
    sequencenum,
    book: 'JAS',
    reference,
    startChapter,
    startVerse,
    endChapter,
    endVerse,
  },
  relationships: { section: rel('section', 'sec-1') },
});

const media = (id: string, passageId: string, transcription: string) => ({
  id,
  type: 'mediafile',
  attributes: { versionNumber: 1, transcription },
  relationships: {
    plan: rel('plan', PLAN_ID),
    passage: rel('passage', passageId),
  },
});

const section = {
  id: 'sec-1',
  type: 'section',
  attributes: { sequencenum: 1, name: 'Listening and Doing' },
  relationships: { plan: rel('plan', PLAN_ID) },
} as unknown as SectionD;

// Typed-in transcription: \c on its own line, no paragraph after it.
const TYPED_1_19 =
  '\\v 19  Be quick to hear\n\\v 27  Pure religion\n\\c 2  \n\\v 1  Show no partiality\n\\v 13 Mercy triumphs';
// Paratext text import (getLocalParatextText): verses joined inline with
// `\c ${chap} ` between chapters.
const PARATEXT_1_19 =
  '\\v 19 Be quick to hear\\v 27 Pure religion\\c 2 \\v 1 Show no partiality\\v 13 Mercy triumphs';

const createDataset = (
  textOutputFormat: 'usx' | 'usj',
  transcription1 = TYPED_1_19
): Record<string, MockRec[]> => ({
  organization: [
    {
      id: TEAM_ID,
      type: 'organization',
      attributes: {
        name: 'Test Team',
        defaultParams: JSON.stringify({
          burritoVersions: '1',
          burritoFormat: { textOutputFormat },
        }),
      },
    },
  ],
  passage: [
    passage('pas-1', 1, '1:19-2:13', [1, 19, 2, 13]),
    passage('pas-2', 2, '2:14-26', [2, 14, 2, 26]),
    passage('pas-3', 3, '3:13-4:12', [3, 13, 4, 12]),
    passage('pas-4', 4, '4:13-17', [4, 13, 4, 17]),
  ],
  mediafile: [
    media('med-1', 'pas-1', transcription1),
    media('med-2', 'pas-2', '\\v 14  Faith without works'),
    media(
      'med-3',
      'pas-3',
      '13 Who is wise\n18 Fruit of righteousness\n\\c 4\n1 What causes quarrels\n12 Who are you to judge'
    ),
    media('med-4', 'pas-4', 'Boasting about tomorrow'),
  ],
});

function createMockMemory(dataset: Record<string, MockRec[]>) {
  const getRecords = (model: string) => dataset[model] ?? [];
  const buildQueryBuilder = () => ({
    findRecord: ({ type, id }: { type: string; id: string }) =>
      getRecords(type).find((r) => r.id === id),
    findRecords: (type: string) => getRecords(type),
  });
  return {
    schema,
    keyMap,
    cache: {
      query: (fn: (q: unknown) => unknown) => fn(buildQueryBuilder()),
      liveQuery: (fn: (q: unknown) => unknown) => {
        let model = '';
        fn({
          findRecords: (m: string) => {
            model = m;
            return {};
          },
        });
        return {
          subscribe: () => () => {},
          query: () => getRecords(model),
        };
      },
    },
    query: (fn: (q: unknown) => unknown) =>
      Promise.resolve(fn(buildQueryBuilder())),
    update: () => Promise.resolve(),
  } as unknown as Memory;
}

const mockStore = createStore(
  combineReducers({
    strings: () => ({
      ...localizationReducer(undefined, { type: '@@INIT' }),
      loaded: true,
      lang: 'en',
    }),
  }),
  applyMiddleware(thunk as never)
);

const metadata = (): Burrito =>
  ({
    format: 'burrito',
    meta: {},
    ingredients: {},
    type: {
      flavorType: {
        name: 'scripture',
        flavor: { name: 'textTranslation' },
        currentScope: {},
      },
    },
  }) as unknown as Burrito;

function Harness() {
  const createText = useBurritoText(TEAM_ID);
  const [result, setResult] = useState('');
  const run = () =>
    createText({
      metadata: metadata(),
      book: 'JAS',
      bookPath: '/data/burrito/JAS',
      preLen: '/data'.length,
      sections: [section],
    })
      .then(() => setResult('ok'))
      .catch((err: Error) => setResult(err.message));
  return (
    <>
      <button id="run-burrito-text" onClick={run}>
        run
      </button>
      <div data-cy="burrito-text-result">{result}</div>
    </>
  );
}

const countUsjChapters = (node: unknown, number: string): number => {
  if (Array.isArray(node))
    return node.reduce((n, c) => n + countUsjChapters(c, number), 0);
  if (node && typeof node === 'object') {
    const rec = node as { type?: string; number?: string; content?: unknown };
    const self = rec.type === 'chapter' && rec.number === number ? 1 : 0;
    return self + countUsjChapters(rec.content, number);
  }
  return 0;
};

describe('useBurritoText cross-chapter export (TT-7716)', () => {
  const mountHarness = (
    textOutputFormat: 'usx' | 'usj',
    transcription1?: string
  ) => {
    const memory = createMockMemory(
      createDataset(textOutputFormat, transcription1)
    );
    cy.window().then((win) => {
      // CT's `process` polyfill has no `versions`; usfm-grammar-web probes
      // `globalThis.process?.versions.node` and would throw before parsing.
      const proc = (win as unknown as { process?: { versions?: object } })
        .process;
      if (proc && !proc.versions) proc.versions = {};
      (win as unknown as { api: unknown }).api = {
        write: cy.stub().as('write').resolves(),
        md5File: cy.stub().resolves('md5'),
      };
    });
    cy.mount(
      <Provider store={mockStore}>
        <GlobalProvider
          init={
            {
              coordinator: {
                getSource: () => memory,
              } as unknown as Coordinator,
              errorReporter: bugsnagClient,
              memory,
              organization: TEAM_ID,
              user: USER_ID,
            } as never
          }
        >
          <DataProvider dataStore={memory}>
            <Harness />
          </DataProvider>
        </GlobalProvider>
      </Provider>
    );
    cy.get('#run-burrito-text').click();
  };

  it('exports USX without USFM parse errors and one chapter 2 and 4', () => {
    mountHarness('usx');
    cy.get('[data-cy="burrito-text-result"]', { timeout: 20000 }).should(
      'have.text',
      'ok'
    );
    cy.get('@write')
      .its('firstCall.args.1')
      .then((usx) => {
        const content = String(usx);
        for (const n of ['1', '2', '3', '4']) {
          expect(
            content.match(new RegExp(`<chapter[^>]*number="${n}"`, 'g')),
            `chapter ${n}`
          ).to.have.length(1);
        }
      });
  });

  it('exports USJ without USFM parse errors and one chapter 2 and 4', () => {
    mountHarness('usj');
    cy.get('[data-cy="burrito-text-result"]', { timeout: 20000 }).should(
      'have.text',
      'ok'
    );
    cy.get('@write')
      .its('firstCall.args.1')
      .then((usj) => {
        const doc = JSON.parse(String(usj));
        for (const n of ['1', '2', '3', '4']) {
          expect(countUsjChapters(doc, n), `chapter ${n}`).to.equal(1);
        }
      });
  });

  it('exports USX for Paratext-imported text with an inline \\c 2 \\v 1', () => {
    mountHarness('usx', PARATEXT_1_19);
    cy.get('[data-cy="burrito-text-result"]', { timeout: 20000 }).should(
      'have.text',
      'ok'
    );
    cy.get('@write')
      .its('firstCall.args.1')
      .then((usx) => {
        const content = String(usx);
        for (const n of ['1', '2', '3', '4']) {
          expect(
            content.match(new RegExp(`<chapter[^>]*number="${n}"`, 'g')),
            `chapter ${n}`
          ).to.have.length(1);
        }
      });
  });
});
