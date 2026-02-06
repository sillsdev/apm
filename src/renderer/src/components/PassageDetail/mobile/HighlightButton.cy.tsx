import React from 'react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import HighlightButton from './HighlightButton';

const mountHighlightButton = ({
  disabled = false,
  highlight = false,
  size = 'medium',
}: {
  disabled?: boolean;
  highlight?: boolean;
  size?: 'small' | 'medium' | 'large';
} = {}) => {
  const onClick = cy.stub().as('onClick');
  const theme = createTheme();

  cy.mount(
    <ThemeProvider theme={theme}>
      <HighlightButton
        ariaLabel="Play highlight"
        onClick={onClick}
        disabled={disabled}
        size={size}
        highlight={highlight}
      >
        <PlayArrowIcon data-cy="highlight-icon" />
      </HighlightButton>
    </ThemeProvider>
  );
};

describe('HighlightButton', () => {
  it('renders the button with child content', () => {
    mountHighlightButton();

    cy.get('[aria-label="Play highlight"]').should('exist');
    cy.get('[data-cy="highlight-icon"]').should('be.visible');
  });

  it('invokes onClick when enabled', () => {
    mountHighlightButton();

    cy.get('[aria-label="Play highlight"]').click();
    cy.get('@onClick').should('have.been.calledOnce');
  });

  it('does not invoke onClick when disabled', () => {
    mountHighlightButton({ disabled: true });

    cy.get('[aria-label="Play highlight"]').should('be.disabled').click({
      force: true,
    });
    cy.get('@onClick').should('not.have.been.called');
  });

  it('applies highlight colors when enabled', () => {
    mountHighlightButton({ highlight: true });

    cy.get('[aria-label="Play highlight"]')
      .should('have.css', 'background-color', 'rgb(25, 118, 210)')
      .and('have.css', 'color', 'rgb(255, 255, 255)');
  });

  it('applies the size class based on prop', () => {
    mountHighlightButton({ size: 'small' });

    cy.get('[aria-label="Play highlight"]').should(
      'have.class',
      'MuiIconButton-sizeSmall'
    );
  });
});
