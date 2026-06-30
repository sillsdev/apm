import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import MarkVersesTableIsMobile from './MarkVersesTableIsMobile';
import type { ICell } from './PassageDetailMarkVersesIsMobile';
import { RefStatus } from '../../../../utils/markVersesSegmentColors';

const sampleData: ICell[][] = [
  [
    { value: 'Start-Stop', readOnly: true },
    { value: 'Reference', readOnly: true },
  ],
  [
    { value: '0.0-10.0', className: 'lim cur' },
    { value: '2:11', className: 'ref', status: RefStatus.Valid },
  ],
  [
    { value: '10.1-18.9', className: 'lim' },
    { value: '2:12', className: 'ref', status: RefStatus.Err },
  ],
];

const mountTable = () => {
  cy.mount(
    <ThemeProvider theme={createTheme()}>
      <MarkVersesTableIsMobile data={sampleData} />
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

  it('shows verse references as read-only text', () => {
    mountTable();

    cy.get('[aria-label="verse-reference-1"]').should('contain.text', '2:11');
    cy.get('[aria-label="verse-reference-2"]').should('contain.text', '2:12');
    cy.get('[aria-label="verse-reference-1"]').should('not.match', 'input');
  });

  it('keeps reference as text when the row has no timestamps', () => {
    const dataWithoutLimits = [
      [
        { value: 'Start-Stop', readOnly: true },
        { value: 'Reference', readOnly: true },
      ],
      [
        { value: '', className: 'lim' },
        { value: '2:11', className: 'ref', readOnly: true, status: RefStatus.Valid },
      ],
    ];
    cy.mount(
      <ThemeProvider theme={createTheme()}>
        <MarkVersesTableIsMobile data={dataWithoutLimits} />
      </ThemeProvider>
    );

    cy.get('[aria-label="verse-reference-1"]').should('contain.text', '2:11');
    cy.get('[aria-label="verse-reference-1"]').should('not.match', 'input');
  });
});
