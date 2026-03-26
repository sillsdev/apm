/// <reference types="cypress" />
import React from 'react';
import { Provider } from 'react-redux';
import {
  applyMiddleware,
  combineReducers,
  legacy_createStore as createStore,
} from 'redux';
import { thunk } from 'redux-thunk';
import { BurritoOption } from './BurritoOption';
import localizationReducer from '../store/localization/reducers';
import type { OptionType } from '../model';

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

const sampleOptions: OptionType[] = [
  { label: 'Zebra', value: 'zebra' },
  { label: 'Apple', value: 'apple' },
  { label: 'Mango', value: 'mango' },
];

describe('BurritoOption', () => {
  beforeEach(() => {
    cy.viewport(480, 520);
  });

  const mountOption = (props: React.ComponentProps<typeof BurritoOption>) => {
    cy.mount(
      <Provider store={mockStore}>
        <BurritoOption {...props} />
      </Provider>
    );
  };

  it('renders options sorted by label', () => {
    mountOption({ options: sampleOptions, value: [] });

    cy.get('[id^="checkbox-list-label-"]')
      .eq(0)
      .should('contain.text', 'Apple');
    cy.get('[id^="checkbox-list-label-"]').eq(1).should('contain.text', 'Mango');
    cy.get('[id^="checkbox-list-label-"]').eq(2).should('contain.text', 'Zebra');
  });

  it('shows Select All when nothing is checked', () => {
    mountOption({ options: sampleOptions, value: [] });

    cy.get('#all-toggle').should('contain.text', 'Select All');
  });

  it('checks boxes that appear in value', () => {
    mountOption({ options: sampleOptions, value: ['zebra', 'apple'] });

    cy.get(`input[aria-labelledby="checkbox-list-label-apple"]`).should(
      'be.checked'
    );
    cy.get(`input[aria-labelledby="checkbox-list-label-zebra"]`).should(
      'be.checked'
    );
    cy.get(`input[aria-labelledby="checkbox-list-label-mango"]`).should(
      'not.be.checked'
    );
  });

  it('calls onChange when an option row is toggled', () => {
    const onChange = cy.stub().as('onChange');
    mountOption({ options: sampleOptions, value: [], onChange });

    cy.get('#checkbox-list-label-mango').click();
    cy.wrap(onChange).should('have.been.calledWith', ['mango']);
  });

  it('select all checks every option and switches footer to Deselect All', () => {
    const onChange = cy.stub().as('onChange');
    mountOption({ options: sampleOptions, value: [], onChange });

    cy.get('#all-toggle').click();
    cy.wrap(onChange).should(
      'have.been.calledWith',
      sampleOptions.map((o) => o.value)
    );
    cy.get('#all-toggle').should('contain.text', 'Deselect All');
    cy.get(`input[aria-labelledby="checkbox-list-label-apple"]`).should(
      'be.checked'
    );
  });

  it('deselect all clears selection when all were selected', () => {
    const onChange = cy.stub().as('onChange');
    mountOption({
      options: sampleOptions,
      value: sampleOptions.map((o) => o.value),
      onChange,
    });

    cy.get('#all-toggle').should('contain.text', 'Deselect All');
    cy.get('#all-toggle').click();
    cy.wrap(onChange).should('have.been.calledWith', []);
    cy.get(`input[aria-labelledby="checkbox-list-label-apple"]`).should(
      'not.be.checked'
    );
  });
});
