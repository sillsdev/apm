import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PassageDetailMobileLayout from '../PassageDetailMobileLayout';

const mountLayout = ({
  withFooterAbove = false,
  contentSx,
}: {
  withFooterAbove?: boolean;
  contentSx?: Record<string, unknown>;
} = {}) => {
  const theme = createTheme();
  cy.mount(
    <ThemeProvider theme={theme}>
      <PassageDetailMobileLayout
        header={<div data-cy="layout-header">Header</div>}
        footer={<div data-cy="layout-footer">Footer</div>}
        footerAbove={
          withFooterAbove ? (
            <div data-cy="layout-footer-above">Footer Above</div>
          ) : undefined
        }
        contentSx={contentSx}
      >
        <div>Content body</div>
      </PassageDetailMobileLayout>
    </ThemeProvider>
  );
};

describe('PassageDetailMobileLayout', () => {
  it('renders header, content, and footer', () => {
    mountLayout();

    cy.get('[data-cy="layout-header"]').should('contain.text', 'Header');
    cy.contains('Content body').should('be.visible');
    cy.get('[data-cy="layout-footer"]').should('contain.text', 'Footer');
  });

  it('renders footerAbove when provided', () => {
    mountLayout({ withFooterAbove: true });

    cy.get('[data-cy="layout-footer-above"]')
      .should('be.visible')
      .and('contain.text', 'Footer Above');
  });

  it('applies contentSx overrides', () => {
    mountLayout({ contentSx: { pt: 4 } });

    cy.contains('Content body')
      .parent()
      .should('have.css', 'padding-top', '32px');
  });
});
