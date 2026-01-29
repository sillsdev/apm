import React from 'react';
import { TabAppBar, ActionHeight } from './TabAppBar';
import { HeadHeight } from '../App';

describe('TabAppBar', () => {
  it('should fix the mobile bar at the top', () => {
    cy.mount(
      <TabAppBar position="fixed" color="default" mobileBar={true}>
        <div>Toolbar</div>
      </TabAppBar>
    );

    cy.get('header.MuiAppBar-root', { timeout: 5000 })
      .should('be.visible')
      .should(($el) => {
        const styles = window.getComputedStyle($el[0]);
        expect(styles.position).to.eq('fixed');
        expect(styles.top).to.eq(`${HeadHeight}px`);
        expect(styles.height).to.eq(`${ActionHeight}px`);
      });
  });
});
