/// <reference types="cypress" />
import React from 'react';
import { Provider } from 'react-redux';
import {
  applyMiddleware,
  combineReducers,
  legacy_createStore as createStore,
} from 'redux';
import { thunk } from 'redux-thunk';
import MetaValue from './MetaValue';
import localizationReducer from '../store/localization/reducers';

const mockStringsReducer = () => {
  const initial = localizationReducer(undefined, { type: '@@INIT' });
  return { ...initial, loaded: true, lang: 'en' };
};

const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
    books: () => ({
      loaded: true,
      suggestions: [],
      bookData: [],
      map: {},
    }),
    orbit: () => ({
      status: undefined as number | undefined,
      message: '',
      saving: false,
      retry: 0,
      fetchResults: undefined,
    }),
    upload: () => ({}),
    paratext: () => ({}),
    importexport: () => ({}),
    auth: () => ({}),
  }),
  applyMiddleware(thunk as never)
);

describe('MetaValue', () => {
  beforeEach(() => {
    cy.viewport(640, 480);
  });

  const mountMetaValue = (props: React.ComponentProps<typeof MetaValue>) => {
    cy.mount(
      <Provider store={mockStore}>
        <MetaValue {...props} />
      </Provider>
    );
  };

  it('renders update dialog when open with initial value', () => {
    mountMetaValue({
      idKey: 'meta|name|en',
      value: 'My Wrapper',
      isOpen: true,
      onConfirm: () => {},
      onOpen: () => {},
    });

    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('Update Value').should('be.visible');
    cy.contains('Please enter the new value for').should('be.visible');
    cy.get('[data-cy="value-input"]')
      .find('textarea, input')
      .first()
      .should('have.value', 'My Wrapper');
  });

  it('does not show dialog when closed', () => {
    mountMetaValue({
      idKey: 'key',
      value: '',
      isOpen: false,
      onConfirm: () => {},
      onOpen: () => {},
    });

    cy.get('[role="dialog"]').should('not.exist');
  });

  it('calls onConfirm with edited value on submit', () => {
    const onConfirm = cy.stub().as('onConfirm');
    const onOpen = cy.stub().as('onOpen');

    mountMetaValue({
      idKey: 'meta|description|en',
      value: 'Old',
      isOpen: true,
      onConfirm,
      onOpen,
    });

    cy.get('[data-cy="value-input"]')
      .find('textarea, input')
      .first()
      .clear()
      .type('New description');
    cy.contains('button', 'Confirm').click();

    cy.wrap(onConfirm).should('have.been.calledWith', 'meta|description|en', 'New description');
    cy.wrap(onOpen).should('have.been.calledWith', false);
  });

  it('calls onOpen(false) when Cancel is clicked', () => {
    const onOpen = cy.stub().as('onOpen');

    mountMetaValue({
      idKey: 'k',
      value: 'v',
      isOpen: true,
      onConfirm: () => {},
      onOpen,
    });

    cy.contains('button', 'Cancel').click();
    cy.wrap(onOpen).should('have.been.calledWith', false);
    cy.get('[role="dialog"]').should('not.exist');
  });

  it('disables confirm and shows warning when input looks like JSON structure', () => {
    mountMetaValue({
      idKey: 'k',
      value: 'plain',
      isOpen: true,
      onConfirm: cy.stub(),
      onOpen: () => {},
    });

    cy.get('[data-cy="value-input"]')
      .find('textarea, input')
      .first()
      .clear()
      .type('{invalid json');

    cy.contains('Warning: Input contains JSON structural characters').should(
      'be.visible'
    );
    cy.contains('button', 'Confirm').should('be.disabled');
  });
});
