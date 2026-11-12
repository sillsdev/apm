import React from 'react';
import { MenuItem } from '@mui/material';
import IconMenu from './IconMenu';

describe('IconMenu', () => {
  it('opens and closes the menu when items are clicked', () => {
    cy.mount(
      <IconMenu icon={<span data-cy="icon">X</span>}>
        <MenuItem data-cy="menu-item">Item</MenuItem>
      </IconMenu>
    );

    cy.get('button[aria-haspopup="true"]').should('be.visible').click();
    cy.get('#icon-menu').should('be.visible');
    cy.get('button[aria-haspopup="true"]').should(
      'have.attr',
      'aria-expanded',
      'true'
    );

    cy.get('[data-cy="menu-item"]').click();
    cy.get('#icon-menu').should('not.exist');
  });

  it('still opens the menu when tip is provided', () => {
    cy.mount(
      <IconMenu tip="Helpful tip" icon={<span data-cy="icon">X</span>}>
        <MenuItem data-cy="menu-item-2">Item</MenuItem>
      </IconMenu>
    );

    cy.get('button[aria-haspopup="true"]').should('be.visible').click();
    cy.get('#icon-menu').should('be.visible');
    cy.get('[data-cy="menu-item-2"]').click();
    cy.get('#icon-menu').should('not.exist');
  });
});
