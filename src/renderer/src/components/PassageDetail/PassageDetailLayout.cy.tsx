import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import PassageDetailLayout from './PassageDetailLayout';

/** Stands in for a collapsed DiscussionPanel: a fab pinned to the corner. */
const PinnedFab = () => (
  <button
    data-cy="layout-fab"
    style={{ position: 'absolute', right: 12, bottom: 12 }}
  >
    Fab
  </button>
);

const mountLayout = ({
  withFooterAbove = false,
  withFab = false,
  tallContent = false,
  contentSx,
}: {
  withFooterAbove?: boolean;
  withFab?: boolean;
  tallContent?: boolean;
  contentSx?: Record<string, unknown>;
} = {}) => {
  const theme = createTheme();
  cy.mount(
    <ThemeProvider theme={theme}>
      <div style={{ height: '300px' }}>
        <PassageDetailLayout
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
          {tallContent && (
            <>
              <div style={{ height: '2000px', flexShrink: 0 }} />
              <div data-cy="layout-last-item" style={{ flexShrink: 0 }}>
                Last item
              </div>
            </>
          )}
          {withFab && <PinnedFab />}
        </PassageDetailLayout>
      </div>
    </ThemeProvider>
  );
};

describe('PassageDetailLayout', () => {
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

  it('positions a pinned fab in the bottom right, clear of the footers', () => {
    mountLayout({ withFab: true, withFooterAbove: true });

    cy.get('[data-cy="layout-fab"]').should('be.visible');
    cy.get('[data-cy="layout-fab"]').then(($fab) => {
      const fab = $fab[0].getBoundingClientRect();
      cy.get('[data-cy="layout-footer-above"]').then(($footerAbove) => {
        const footerAbove = $footerAbove[0].getBoundingClientRect();
        expect(fab.bottom).to.be.at.most(footerAbove.top);
      });
      cy.get('[data-cy="layout-content"]').then(($content) => {
        const content = $content[0].getBoundingClientRect();
        // Bottom right of the content region.
        expect(fab.right).to.be.at.most(content.right);
        expect(fab.right).to.be.greaterThan(content.left + content.width / 2);
      });
    });
  });

  it('keeps the fab pinned and reserves scroll space so content clears it', () => {
    mountLayout({ withFab: true, tallContent: true });

    cy.get('[data-cy="layout-content"]').scrollTo('bottom');
    cy.get('[data-cy="layout-last-item"]').then(($last) => {
      const last = $last[0].getBoundingClientRect();
      cy.get('[data-cy="layout-fab"]').then(($fab) => {
        const fab = $fab[0].getBoundingClientRect();
        expect(last.bottom).to.be.at.most(fab.top);
      });
    });
  });

  it('applies contentSx overrides', () => {
    mountLayout({ contentSx: { pt: 4 } });

    cy.contains('Content body')
      .parent()
      .should('have.css', 'padding-top', '32px');
  });
});
