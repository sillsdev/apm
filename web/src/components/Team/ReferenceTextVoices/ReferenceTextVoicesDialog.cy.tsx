import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import Memory from '@orbit/memory';
import bugsnagClient from '../../../auth/bugsnagClient';
import { GlobalProvider } from '../../../context/GlobalContext';
import { TeamContext } from '../../../context/TeamContext';
import DataProvider from '../../../hoc/DataProvider';
import localizationReducer from '../../../store/localization/reducers';
import { ReferenceTextVoicesDialog } from './ReferenceTextVoicesDialog';

const TEAM_ID = 'team-1';

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

const voice = (name: string, lang: string, localService = true) => ({
  name,
  voiceURI: name,
  lang,
  localService,
  default: false,
});

// Fixed voices, so the result doesn't depend on the machine
const deviceVoices = [
  voice('Microsoft David', 'en-US'),
  voice('Microsoft Zira', 'en-US'),
  voice('Google UK English Female', 'en-GB', false),
  voice('Amelie', 'fr-FR'),
];

const mark = {
  name: 'Microsoft Mark',
  voiceURI: 'Microsoft Mark',
  lang: 'en-US',
  localService: true,
};

// The browser's utterance only takes real voices, and these are plain objects.
class FakeUtterance {
  text: string;
  voice: unknown = null;
  lang = '';
  constructor(text: string) {
    this.text = text;
  }
}

const mockStore = createStore(
  combineReducers({
    strings: () => ({
      ...localizationReducer(undefined, { type: '@@INIT' }),
      loaded: true,
      lang: 'en',
    }),
  })
);

const teamRecord = (defaults: object) => ({
  id: TEAM_ID,
  type: 'organization',
  attributes: { name: 'Team', defaultParams: JSON.stringify(defaults) },
});

const savedDefaults = (records: RecordsByKey) =>
  JSON.parse(records[`organization:${TEAM_ID}`].attributes.defaultParams);

const mountDialog = (defaults: object = {}) => {
  const records: RecordsByKey = {
    [`organization:${TEAM_ID}`]: teamRecord(defaults),
  };
  const memory = createMockMemory(records);
  const onClose = cy.stub().as('onClose');
  cy.window().then((win) => {
    try {
      win.localStorage.removeItem('ttsShowOnlineVoices');
    } catch {
      // storage blocked: online voices start hidden anyway
    }
    cy.stub(win.speechSynthesis, 'getVoices').returns(deviceVoices);
    cy.stub(win.speechSynthesis, 'speak').as('speak');
    cy.stub(win.speechSynthesis, 'cancel');
    cy.stub(win, 'SpeechSynthesisUtterance').value(FakeUtterance);
  });
  cy.mount(
    <Provider store={mockStore}>
      <GlobalProvider
        init={
          {
            memory,
            errorReporter: bugsnagClient,
            organization: TEAM_ID,
            user: 'user-1',
            offlineOnly: false,
            connected: true,
          } as any
        }
      >
        <DataProvider dataStore={memory}>
          <TeamContext.Provider
            value={
              {
                state: { personalProjects: [], teamProjects: () => [] },
                setState: () => undefined,
              } as any
            }
          >
            <ReferenceTextVoicesDialog team={TEAM_ID} onClose={onClose} />
          </TeamContext.Provider>
        </DataProvider>
      </GlobalProvider>
    </Provider>
  );
  return records;
};

const group = (language: string) => cy.contains('.MuiAccordion-root', language);

describe('ReferenceTextVoicesDialog', () => {
  it('ranks voices for a language and saves the ranking', () => {
    const records = mountDialog();
    group('English').click();
    group('English')
      .contains('li', 'Microsoft Zira')
      .find('button[aria-label="Add to ranking"]')
      .click();
    group('English')
      .contains('li', 'Microsoft David')
      .find('button[aria-label="Add to ranking"]')
      .click();
    group('English')
      .contains('li', 'Microsoft David')
      .find('button[aria-label="Move up"]')
      .click();
    group('English').should('contain.text', '2 ranked');
    cy.get('#tts-filter-reference-texts').check();
    cy.get('#tts-save').click();
    cy.get('@onClose').should('have.been.called');
    cy.then(() => {
      const saved = savedDefaults(records);
      expect(
        saved.ttsVoices.en.map((v: { name: string }) => v.name)
      ).to.deep.equal(['Microsoft David', 'Microsoft Zira']);
      expect(saved.ttsFilterRefText).to.equal(true);
    });
  });

  it('saves nothing on Cancel', () => {
    const records = mountDialog();
    group('French').click();
    group('French').find('button[aria-label="Add to ranking"]').click();
    cy.get('#tts-cancel').click();
    cy.get('@onClose').should('have.been.called');
    cy.then(() => expect(savedDefaults(records).ttsVoices).to.equal(undefined));
  });

  it('hides unranked online voices until asked', () => {
    mountDialog();
    group('English').click();
    group('English').should('not.contain.text', 'Google UK English Female');
    cy.get('#tts-show-online').check();
    group('English')
      .contains('li', 'Google UK English Female')
      .should('contain.text', 'Online · Google');
  });

  it('opens ranked languages first and keeps a ranked voice this device lacks', () => {
    mountDialog({ ttsVoices: { en: [mark] } });
    cy.get('.MuiAccordion-root').first().should('contain.text', 'English');
    group('English')
      .contains('li', 'Microsoft Mark')
      .should('contain.text', 'Not on this device')
      .find('button[aria-label="Read"]')
      .should('be.disabled');
  });

  it('reads the sample text with the chosen voice', () => {
    mountDialog();
    cy.get('#tts-sample').clear().type('Bonjour tout le monde.');
    group('French').click();
    group('French').find('button[aria-label="Read"]').click();
    cy.get('@speak').should('have.been.calledOnce');
    cy.get('@speak').then((speak) => {
      const [utterance] = (
        speak as unknown as { firstCall: { args: [FakeUtterance] } }
      ).firstCall.args;
      expect(utterance.text).to.equal('Bonjour tout le monde.');
      expect((utterance.voice as { name: string }).name).to.equal('Amelie');
    });
  });

  it('allows the Reference Text filter only once a voice is ranked', () => {
    mountDialog();
    cy.get('#tts-filter-reference-texts').should('be.disabled');
    cy.get('#tts-search').type('fre');
    cy.get('.MuiAccordion-root').should('have.length', 1);
    group('French').click();
    group('French').find('button[aria-label="Add to ranking"]').click();
    cy.get('#tts-filter-reference-texts').should('not.be.disabled');
  });
});
