import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import LocalizedStrings from 'react-localization';
import { RecordButton } from './RecordButton';

const mockRecordButtonStrings = new LocalizedStrings({
  en: {
    record: 'Record',
    rerecord: 'Rerecord',
    resume: 'Resume',
  },
});

const mockStringsReducer = () => ({
  loaded: true,
  lang: 'en',
  recordButton: mockRecordButtonStrings,
});

const createMockStore = () =>
  createStore(
    combineReducers({
      strings: mockStringsReducer,
    })
  );

const mountRecordButton = (
  props: React.ComponentProps<typeof RecordButton>
) => {
  const store = createMockStore();
  cy.mount(
    <Provider store={store}>
      <RecordButton {...props} />
    </Provider>
  );
};

describe('RecordButton', () => {
  it('renders the default icon button when not recording', () => {
    mountRecordButton({
      recording: false,
      onClick: cy.stub(),
      disabled: false,
      tooltipTitle: 'Record',
    });

    cy.get('[role="button"]').should('be.visible');
    cy.get('svg').should('exist');
    cy.get('svg[data-testid="PauseIcon"]').should('not.exist');
    cy.get('svg[data-testid="StopIcon"]').should('not.exist');
  });

  it('calls onClick for mouse and keyboard activation', () => {
    const onClick = cy.stub().as('onClick');
    mountRecordButton({
      recording: false,
      onClick,
      disabled: false,
      tooltipTitle: 'Record',
    });

    cy.get('[role="button"]').click();
    cy.get('[role="button"]').trigger('keydown', { key: 'Enter' });
    cy.wrap(onClick).should('have.been.calledTwice');
  });

  it('does not call onClick when disabled', () => {
    const onClick = cy.stub().as('onClick');
    mountRecordButton({
      recording: false,
      onClick,
      disabled: true,
      tooltipTitle: 'Record',
    });

    cy.get('[role="button"]').click();
    cy.get('[role="button"]').trigger('keydown', { key: 'Enter' });
    cy.wrap(onClick).should('not.have.been.called');
  });

  it('shows record text when showText is enabled without a recording', () => {
    mountRecordButton({
      recording: false,
      onClick: cy.stub(),
      disabled: false,
      showText: true,
      hasRecording: false,
    });

    cy.contains('Record').should('be.visible');
  });

  it('shows resume text when showText is enabled with a recording', () => {
    mountRecordButton({
      recording: false,
      onClick: cy.stub(),
      disabled: false,
      showText: true,
      hasRecording: true,
      isStopLogic: false,
    });

    cy.contains('Resume').should('be.visible');
  });

  it('shows rerecord text when stop logic is enabled with a recording', () => {
    mountRecordButton({
      recording: false,
      onClick: cy.stub(),
      disabled: false,
      showText: true,
      hasRecording: true,
      isStopLogic: true,
    });

    cy.contains('Rerecord').should('be.visible');
  });

  it('renders pause or stop icons based on recording state', () => {
    mountRecordButton({
      recording: true,
      onClick: cy.stub(),
      disabled: false,
      isStopLogic: false,
    });

    cy.get('svg[data-testid="PauseIcon"]').should('be.visible');

    mountRecordButton({
      recording: true,
      onClick: cy.stub(),
      disabled: false,
      isStopLogic: true,
    });

    cy.get('svg[data-testid="StopIcon"]').should('be.visible');
  });
});
