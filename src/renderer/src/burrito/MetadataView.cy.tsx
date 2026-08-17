/// <reference types="cypress" />
import React from 'react';
import { Provider } from 'react-redux';
import {
  applyMiddleware,
  combineReducers,
  legacy_createStore as createStore,
} from 'redux';
import { thunk } from 'redux-thunk';
import { MetadataView } from './MetadataView';
import { wrapperBuilder } from './data/wrapperBuilder';
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

function testWrapper() {
  return wrapperBuilder({
    genName: 'TestBuilder',
    genVersion: '1.0.0',
    version: '0.0.1',
    name: 'Test Wrapper',
    abbreviation: 'TEST',
    description: 'Test description',
    burritos: [
      {
        id: 'test-burrito',
        path: 'test/',
        role: 'testRole',
      },
    ],
  });
}

describe('MetadataView', () => {
  beforeEach(() => {
    cy.viewport(800, 720);
  });

  const mountView = (wrapper = testWrapper()) => {
    cy.mount(
      <Provider store={mockStore}>
        <MetadataView wrapper={wrapper} />
      </Provider>
    );
  };

  it('renders wrapper metadata in the tree', () => {
    mountView();

    cy.get('[role="tree"]').should('exist');
    cy.contains('format: scripture burrito wrapper').should('be.visible');
    cy.contains('meta').should('be.visible');
    cy.contains('contents').should('be.visible');
    cy.contains('version: 0.0.1').should('be.visible');
    cy.contains('en: Test Wrapper').should('be.visible');
    cy.contains('id: test-burrito').should('be.visible');
  });

  it('opens MetaValue when a primitive leaf is clicked', () => {
    mountView();

    cy.contains('version: 0.0.1').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('Update Value').should('be.visible');
    cy.get('[data-cy="value-input"]')
      .find('textarea, input')
      .first()
      .should('have.value', '0.0.1');
  });

  it('updates the tree after confirming an edit in MetaValue', () => {
    mountView();

    cy.contains('version: 0.0.1').click();
    cy.get('[data-cy="value-input"]')
      .find('textarea, input')
      .first()
      .clear()
      .type('0.0.2');
    cy.contains('button', 'Confirm').click();

    cy.get('[role="dialog"]').should('not.exist');
    cy.contains('version: 0.0.2').should('be.visible');
    cy.contains('version: 0.0.1').should('not.exist');
  });
});
