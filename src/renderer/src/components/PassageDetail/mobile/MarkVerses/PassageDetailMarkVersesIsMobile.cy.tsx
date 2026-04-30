import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import MarkVersesTableIsMobile from './MarkVersesTableIsMobile';

const sampleData = [
  [
    { value: 'Start-Stop', readOnly: true },
    { value: 'Reference', readOnly: true },
  ],
  [
    { value: '0.0-10.0', className: 'lim cur' },
    { value: '2:11', className: 'ref' },
  ],
  [
    { value: '10.1-18.9', className: 'lim' },
    { value: '2:12', className: 'ref Err' },
  ],
];

const mountTable = () => {
  const onCellsChanged = cy.stub();
  const onParsePaste = cy.stub().returns([]);

  cy.wrap(onCellsChanged).as('onCellsChanged');
  cy.wrap(onParsePaste).as('onParsePaste');

  cy.mount(
    <ThemeProvider theme={createTheme()}>
      <MarkVersesTableIsMobile
        data={sampleData}
        onCellsChanged={onCellsChanged}
        onParsePaste={onParsePaste}
      />
    </ThemeProvider>
  );
};

describe('MarkVersesTableIsMobile', () => {
  it('renders marker timestamps in a mobile table', () => {
    mountTable();

    cy.contains('Start-Stop').should('be.visible');
    cy.contains('Reference').should('be.visible');
    cy.contains('0.0-10.0').should('be.visible');
    cy.contains('10.1-18.9').should('be.visible');
  });

  it('updates the selected reference cell', () => {
    mountTable();

    // Reference <input> is `readOnly` when the cell is not disabled so taps go to
    // the parent dialog; exercise onChange by clearing readOnly in the test only.
    const ref1 = 'input[aria-label="verse-reference-1"]';
    cy.get(ref1)
      .should('have.value', '2:11')
      .and('have.attr', 'readOnly');
    cy.get(ref1).then(($el) => {
      ($el[0] as HTMLInputElement).readOnly = false;
    });
    cy.get(ref1).clear().type('2:15');
    cy.get('@onCellsChanged').should('have.been.called');
  });
});