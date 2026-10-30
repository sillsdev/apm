import React, { useState } from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import Memory from '@orbit/memory';
import bugsnagClient from '../../../auth/bugsnagClient';
import { GlobalProvider } from '../../../context/GlobalContext';
import { TeamContext } from '../../../context/TeamContext';
import DataProvider from '../../../hoc/DataProvider';
import localizationReducer from '../../../store/localization/reducers';
import type { ReferenceText } from '../../../business/referenceText/referenceText';
import { initProjectState, IProjectDialog } from './projectDialogTypes';
import { ProjectScripture } from './ProjectScripture';

const TEAM_ID = 'team-1';

// Real catalog entries (web/src/assets/reference_text_bibles.json)
const NT_ONLY = 'English Majority Text Version';
const WHOLE = 'Free Bible Version';
const OT_ONLY = 'JPS TaNaKH 1917';
const USED = 'King James (Authorized) Version';

type RecordsByKey = Record<string, any>;

const createMockMemory = (records: RecordsByKey) => {
  const q = {
    findRecords: (type: string) =>
      Object.entries(records)
        .filter(([key]) => key.startsWith(`${type}:`))
        .map(([, rec]) => rec),
    findRecord: ({ type, id }: { type: string; id: string }) =>
      records[`${type}:${id}`],
  };
  const runQuery = (fn: (qb: typeof q) => unknown) => fn(q);
  return {
    cache: {
      query: runQuery,
      liveQuery: (fn: (qb: typeof q) => unknown) => ({
        subscribe: () => () => undefined,
        query: () => runQuery(fn),
      }),
    },
    query: async (fn: (qb: typeof q) => unknown) => runQuery(fn),
    update: cy.stub().resolves(),
    keyMap: { idToKey: () => undefined, keyToId: () => undefined },
  } as unknown as Memory;
};

const usedText: ReferenceText = {
  id: 'eng_kjv',
  name: USED,
  englishName: 'King James Version',
  language: 'eng',
  languageName: 'English',
  languageEnglishName: 'English',
  textDirection: 'ltr',
  license: 'Public Domain',
  books: 'GEN LUK',
};

const records: RecordsByKey = {
  'project:other': {
    id: 'other',
    type: 'project',
    attributes: {
      name: 'Other',
      defaultParams: JSON.stringify({ referenceTexts: [usedText] }),
    },
  },
};

// The team ranked a French voice and limits Reference Texts to its languages (ADR 0015).
const teamFilteredToFrench = {
  [`organization:${TEAM_ID}`]: {
    id: TEAM_ID,
    type: 'organization',
    attributes: {
      name: 'Team',
      defaultParams: JSON.stringify({
        ttsVoices: {
          fr: [
            {
              name: 'Amelie',
              voiceURI: 'Amelie',
              lang: 'fr-FR',
              localService: true,
            },
          ],
        },
        ttsFilterRefText: true,
      }),
    },
  },
};

const booksState = {
  loaded: true,
  suggestions: [
    { value: 'GEN', label: 'Genesis' },
    { value: 'TOB', label: 'Tobit' },
    { value: 'LUK', label: 'Luke' },
  ],
  map: { GEN: 'Genesis', TOB: 'Tobit', LUK: 'Luke' },
  bookData: [],
};

const mockStore = createStore(
  combineReducers({
    strings: () => ({
      ...localizationReducer(undefined, { type: '@@INIT' }),
      loaded: true,
      lang: 'en',
    }),
    books: () => booksState,
  })
);

function Harness(props: { initial?: Partial<IProjectDialog> }) {
  const [state, setState] = useState<IProjectDialog>({
    ...initProjectState,
    ...props.initial,
  });
  return (
    <>
      <ProjectScripture state={state} setState={setState} team={TEAM_ID} />
      <div data-cy="saved-book">{state.book}</div>
      <div data-cy="saved-texts">
        {state.referenceTexts.map((r) => r.name).join('|')}
      </div>
    </>
  );
}

const mountScripture = (
  initial?: Partial<IProjectDialog>,
  extraRecords: RecordsByKey = {}
) => {
  const memory = createMockMemory({ ...records, ...extraRecords });
  const teamState = {
    personalProjects: [],
    teamProjects: () => [
      { id: 'vp-other', relationships: { project: { data: { id: 'other' } } } },
    ],
  };
  cy.mount(
    <Provider store={mockStore}>
      <GlobalProvider
        init={
          {
            memory,
            errorReporter: bugsnagClient,
            organization: TEAM_ID,
            offlineOnly: false,
            connected: true,
          } as any
        }
      >
        <DataProvider dataStore={memory}>
          <TeamContext.Provider
            value={{ state: teamState, setState: () => undefined } as any}
          >
            <Harness initial={initial} />
          </TeamContext.Provider>
        </DataProvider>
      </GlobalProvider>
    </Provider>
  );
};

const pickBook = (name: string) => {
  cy.get('#project-book').click();
  cy.contains('[role="option"]', new RegExp(`^${name}$`)).click();
};

const pick = (picker: string, name: string) => {
  cy.get(picker).clear().type(name);
  cy.contains('[role="option"]', name).click();
};

describe('ProjectScripture', () => {
  it('waits for a book before offering Reference Texts', () => {
    mountScripture();
    cy.get('#primary-reference-text').should('be.disabled');
    cy.get('#secondary-reference-text').should('be.disabled');
    cy.contains('Choose a book to see reference texts');
  });

  it('offers only canonical books and stores the publishing slot', () => {
    mountScripture();
    cy.get('#project-book').click();
    cy.get('[role="option"]').should('have.length', 2);
    cy.contains('[role="option"]', 'Tobit').should('not.exist');
    cy.contains('[role="option"]', 'Luke').click();
    cy.get('[data-cy="saved-book"]').should('have.text', 'B03');
  });

  it('offers only Bibles that have the book', () => {
    mountScripture({ book: 'B03' });
    cy.get('#primary-reference-text').should('not.be.disabled').type(NT_ONLY);
    cy.contains('[role="option"]', NT_ONLY).should('exist');
    cy.get('#primary-reference-text').clear().type(OT_ONLY);
    cy.contains('[role="option"]', OT_ONLY).should('not.exist');
  });

  it('finds Bibles by language code and groups them under the language', () => {
    mountScripture({ book: 'B03' });
    cy.get('#primary-reference-text').should('not.be.disabled').type('ach');
    cy.contains('[role="option"]', 'Acoli Bible Revision').should('exist');
    cy.contains('.MuiAutocomplete-groupLabel', 'Acoli').should('exist');
  });

  it('names a language CLDR knows in the UI language', () => {
    mountScripture({ book: 'B03' });
    cy.get('#primary-reference-text').should('not.be.disabled').type('العربية');
    cy.contains('.MuiAutocomplete-groupLabel', /^Arabic$/).should('exist');
  });

  it('shows the license, localizing Public Domain', () => {
    mountScripture({ book: 'B03' });
    cy.get('#primary-reference-text').should('not.be.disabled').type(USED);
    cy.contains('[role="option"]', USED).should(
      'contain.text',
      'Public Domain'
    );
    cy.get('#primary-reference-text').clear().type(NT_ONLY);
    cy.contains('[role="option"]', NT_ONLY).should(
      'contain.text',
      'CC BY-NC-ND'
    );
    cy.get('#primary-reference-text').clear().type('NET Bible');
    cy.contains('[role="option"]', 'NET Bible').should(
      'contain.text',
      'License not stated'
    );
  });

  it('lists Bibles the team already uses first', () => {
    mountScripture({ book: 'B03' });
    cy.get('#primary-reference-text').should('not.be.disabled').click();
    cy.get('.MuiAutocomplete-groupLabel')
      .first()
      .should('have.text', 'Used in this team');
  });

  it('keeps Secondary distinct and promotes it when Primary is cleared', () => {
    mountScripture({ book: 'B03' });
    pick('#primary-reference-text', NT_ONLY);
    cy.get('#secondary-reference-text').type(NT_ONLY);
    cy.contains('[role="option"]', NT_ONLY).should('not.exist');
    pick('#secondary-reference-text', WHOLE);
    cy.get('[data-cy="saved-texts"]').should(
      'have.text',
      `${NT_ONLY}|${WHOLE}`
    );
    cy.get('#primary-reference-text')
      .parent()
      .find('.MuiAutocomplete-clearIndicator')
      .click({ force: true });
    cy.get('[data-cy="saved-texts"]').should('have.text', WHOLE);
  });

  it('drops Reference Texts that do not have the new book', () => {
    mountScripture({ book: 'B03' });
    pick('#primary-reference-text', NT_ONLY);
    pick('#secondary-reference-text', WHOLE);
    pickBook('Genesis');
    cy.get('[data-cy="saved-book"]').should('have.text', 'A01');
    cy.get('[data-cy="saved-texts"]').should('have.text', WHOLE);
    cy.contains(`${NT_ONLY} was removed because it does not include Genesis.`);
  });

  it('offers only languages with a ranked voice when the team filters', () => {
    mountScripture(
      { book: 'B03', referenceTexts: [usedText] },
      teamFilteredToFrench
    );
    cy.contains('Showing only languages your team has ranked voices for.');
    // The chosen English Primary stays, though English is filtered out
    cy.get('#primary-reference-text').should('have.value', USED);
    cy.get('#secondary-reference-text').should('not.be.disabled').type(NT_ONLY);
    cy.contains('[role="option"]', NT_ONLY).should('not.exist');
    cy.get('#secondary-reference-text').clear().type('Louis Segond');
    cy.contains('[role="option"]', 'Louis Segond 1910').should('exist');
  });

  it('offers every language when the team does not filter', () => {
    mountScripture({ book: 'B03' });
    cy.contains(
      'Showing only languages your team has ranked voices for.'
    ).should('not.exist');
    cy.get('#primary-reference-text').should('not.be.disabled').type(NT_ONLY);
    cy.contains('[role="option"]', NT_ONLY).should('exist');
  });
});
