import React from 'react';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, combineReducers } from 'redux';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import localizationReducer from '../../../../store/localization/reducers';
import { DeleteDialog } from './DeleteDialog';

const mockStringsReducer = () => {
  const initialState = localizationReducer(undefined, { type: '@@INIT' });
  return {
    ...initialState,
    loaded: true,
    lang: 'en',
  };
};

const mockStore = createStore(
  combineReducers({
    strings: mockStringsReducer,
  })
);

describe('DeleteDialog', () => {
  const mountDialog = (
    props: Partial<React.ComponentProps<typeof DeleteDialog>> = {}
  ) => {
    const theme = createTheme();
    cy.viewport(480, 800);

    cy.mount(
      <Provider store={mockStore}>
        <ThemeProvider theme={theme}>
          <DeleteDialog
            handleCancel={cy.stub().as('handleCancel')}
            handleDelete={cy.stub().as('handleDelete')}
          />
        </ThemeProvider>
      </Provider>
    );
  };

  it('renders the reset/discard copy and action buttons', () => {
    mountDialog();

    cy.get('[data-cy="delete-dialog"]').should('be.visible');
    cy.contains('Reset Recording').should('be.visible');
    cy.contains('Would you like to discard this recording or save it?').should(
      'be.visible'
    );

    cy.get('[data-cy="delete-dialog-cancel"]').should('be.visible');
    cy.get('[data-cy="delete-dialog-delete"]').should('be.visible');
    cy.get('[data-cy="delete-dialog-save"]').should('be.visible');
  });

  it('calls handleCancel when cancel is clicked', () => {
    mountDialog();

    cy.get('[data-cy="delete-dialog-cancel"]').click();
    cy.get('@handleCancel').should('have.been.calledOnce');
  });

  it('calls handleDelete when delete is clicked', () => {
    mountDialog();

    cy.get('[data-cy="delete-dialog-delete"]').click();
    cy.get('@handleDelete').should('have.been.calledOnce');
  });
});
