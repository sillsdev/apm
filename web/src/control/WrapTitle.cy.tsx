import React from 'react';
import { WrapTitle, WrapTitleId } from './WrapTitle';

const mountWrapTitle = (args: {
  width: number;
  text: string;
  onParentClick?: () => void;
}) => {
  const { width, text, onParentClick } = args;

  const Harness = () => {
    const [expandedId, setExpandedId] = React.useState<WrapTitleId>(null);
    return (
      <div style={{ width }} onClick={onParentClick}>
        <WrapTitle
          id="t1"
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          dataCy="wrap-title"
        >
          {text}
        </WrapTitle>
      </div>
    );
  };

  cy.mount(<Harness />);
};

describe('WrapTitle', () => {
  beforeEach(() => {
    cy.window().then((win) => {
      // JSDOM-ish environments can be missing ResizeObserver.
      if (!win.ResizeObserver) {
        class ResizeObserver {
          observe() {}
          disconnect() {}
        }
        (win as any).ResizeObserver = ResizeObserver;
      }
    });
  });

  it('expands and collapses when truncated', () => {
    mountWrapTitle({
      width: 120,
      text: 'This is a very long title that should be truncated in a narrow container',
    });

    cy.get('[data-cy="wrap-title"]')
      .should('have.css', 'white-space', 'nowrap')
      .and('have.css', 'text-overflow', 'ellipsis');

    cy.get('[data-cy="wrap-title"]').click();
    cy.get('[data-cy="wrap-title"]')
      .should('have.css', 'white-space', 'normal')
      .and('have.css', 'overflow', 'visible');

    cy.get('[data-cy="wrap-title"]').click();
    cy.get('[data-cy="wrap-title"]').should(
      'have.css',
      'white-space',
      'nowrap'
    );
  });

  it('stops propagation when toggling expand/collapse', () => {
    const onParentClick = cy.stub().as('onParentClick');
    mountWrapTitle({
      width: 120,
      text: 'This is a very long title that should be truncated in a narrow container',
      onParentClick,
    });

    cy.get('[data-cy="wrap-title"]').click();
    cy.wrap(onParentClick).should('not.have.been.called');

    cy.get('[data-cy="wrap-title"]').click();
    cy.wrap(onParentClick).should('not.have.been.called');
  });

  it('does not stop propagation when not truncated', () => {
    const onParentClick = cy.stub().as('onParentClick');
    mountWrapTitle({
      width: 600,
      text: 'Short title',
      onParentClick,
    });

    cy.get('[data-cy="wrap-title"]').should(
      'have.css',
      'white-space',
      'nowrap'
    );
    cy.get('[data-cy="wrap-title"]').click();
    cy.wrap(onParentClick).should('have.been.calledOnce');
  });
});
