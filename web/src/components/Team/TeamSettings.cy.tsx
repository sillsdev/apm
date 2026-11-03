import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import Memory from '@orbit/memory';
import bugsnagClient from '../../auth/bugsnagClient';
import localizationReducer from '../../store/localization/reducers';
import { GlobalProvider } from '../../context/GlobalContext';
import { TeamContext } from '../../context/TeamContext';
import DataProvider from '../../hoc/DataProvider';
import { DialogMode, Organization } from '../../model';
import { BOLD_WORKFLOW_PROCESS, defaultWorkflow } from '../../crud';
import TeamSettings from './TeamSettings';

const TEAM_ID = 'team-1';
const PERSONAL_TEAM_ID = 'personal-team';
const USER_ID = 'user-1';
const ADMIN_ROLE_ID = 'admin-role-id';

type RecordsByKey = Record<string, any>;

const createMockMemory = (records: RecordsByKey): Memory => {
  const byType = (type: string) =>
    Object.entries(records)
      .filter(([key]) => key.startsWith(`${type}:`))
      .map(([, rec]) => rec);

  const q = {
    findRecords: (type: string) => byType(type),
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

const mockStore = createStore(
  combineReducers({
    strings: () => ({
      ...localizationReducer(undefined, { type: '@@INIT' }),
      loaded: true,
      lang: 'en',
    }),
  })
);

const teamRecord = (id: string, name: string): Organization =>
  ({
    id,
    type: 'organization',
    attributes: { name, defaultParams: '{}' },
    relationships: {},
  }) as Organization;

const adminRecords = (teamId: string): RecordsByKey => ({
  [`organization:${teamId}`]: teamRecord(teamId, 'Team'),
  [`role:${ADMIN_ROLE_ID}`]: {
    id: ADMIN_ROLE_ID,
    type: 'role',
    attributes: { roleName: 'Admin', orgRole: true },
    keys: { remoteId: 'admin-role-remote' },
  },
  [`organizationmembership:mbr-1`]: {
    id: 'mbr-1',
    type: 'organizationmembership',
    relationships: {
      user: { data: { type: 'user', id: USER_ID } },
      organization: { data: { type: 'organization', id: teamId } },
      role: { data: { type: 'role', id: ADMIN_ROLE_ID } },
    },
    keys: { remoteId: 'mbr-remote' },
  },
});

const workflowStep = (teamId: string, process: string) => ({
  id: 'step-1',
  type: 'orgworkflowstep',
  attributes: {
    name: 'Step',
    sequencenum: 1,
    process,
    tool: JSON.stringify({ tool: 'discuss', settings: '' }),
    permissions: '{}',
  },
  relationships: {
    organization: { data: { type: 'organization', id: teamId } },
  },
  keys: { remoteId: 'step-remote' },
});

const defaultValues = {
  features: {},
  workflowProgression: 'passage',
  permissions: false,
};

type MountOpts = {
  mode?: DialogMode;
  process?: string;
  workflowProcess?: string;
  withSetTtsVoices?: boolean;
};

const mountSettings = (opts: MountOpts = {}) => {
  const {
    mode = DialogMode.edit,
    process,
    workflowProcess = defaultWorkflow,
    withSetTtsVoices = mode === DialogMode.add,
  } = opts;
  const records: RecordsByKey = {
    ...adminRecords(TEAM_ID),
    [`orgworkflowstep:step-1`]: workflowStep(TEAM_ID, workflowProcess),
  };
  const memory = createMockMemory(records);
  const setValue = cy.stub().as('setValue');
  const setTtsVoices = withSetTtsVoices
    ? cy.stub().as('setTtsVoices')
    : undefined;

  cy.mount(
    <Provider store={mockStore}>
      <GlobalProvider
        init={
          {
            memory,
            errorReporter: bugsnagClient,
            organization: TEAM_ID,
            user: USER_ID,
            offline: false,
            offlineOnly: false,
            connected: true,
          } as any
        }
      >
        <DataProvider dataStore={memory}>
          <TeamContext.Provider
            value={
              {
                state: {
                  personalTeam: PERSONAL_TEAM_ID,
                  personalProjects: [],
                  teamProjects: () => [],
                },
                setState: () => undefined,
              } as any
            }
          >
            <TeamSettings
              mode={mode}
              team={
                mode === DialogMode.add
                  ? undefined
                  : (records[`organization:${TEAM_ID}`] as Organization)
              }
              values={defaultValues}
              setValue={setValue}
              setTtsVoices={setTtsVoices}
              process={process}
            />
          </TeamContext.Provider>
        </DataProvider>
      </GlobalProvider>
    </Provider>
  );
};

describe('TeamSettings Reference Text Voices', () => {
  it('hides Reference Text Voices for a Bold team admin', () => {
    mountSettings({ workflowProcess: BOLD_WORKFLOW_PROCESS });
    cy.contains('Settings').click();
    cy.get('#ttsVoices').should('not.exist');
  });

  it('shows Reference Text Voices for a non-Bold team admin', () => {
    mountSettings({ workflowProcess: defaultWorkflow });
    cy.contains('Settings').click();
    cy.get('#ttsVoices').should('exist');
  });

  it('hides Reference Text Voices when adding a Bold team', () => {
    mountSettings({
      mode: DialogMode.add,
      process: BOLD_WORKFLOW_PROCESS,
      withSetTtsVoices: true,
    });
    cy.contains('Settings').click();
    cy.get('#ttsVoices').should('not.exist');
  });
});
