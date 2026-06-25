import React from 'react';
import { VertListDnd } from './VertListDnd';

describe('VertListDnd', () => {
  it('renders list item content from children', () => {
    cy.mount(
      <VertListDnd dragHandle dragHandleRegion="top-half">
        <div data-cy="row-0">Alpha</div>
        <div data-cy="row-1">Beta</div>
      </VertListDnd>
    );

    cy.get('[data-cy="row-0"]').should('contain.text', 'Alpha');
    cy.get('[data-cy="row-1"]').should('contain.text', 'Beta');
  });

  it('does not block clicks on interactive content when dragHandleRegion is top-half', () => {
    const onAction = cy.stub().as('onAction');
    cy.mount(
      <VertListDnd dragHandle dragHandleRegion="top-half">
        <div>Alpha</div>
        <div>
          <button
            type="button"
            data-cy="item-action"
            onClick={() => onAction()}
          >
            Tap me
          </button>
        </div>
      </VertListDnd>
    );

    cy.get('[data-cy="item-action"]').should('be.visible').click();
    cy.wrap(onAction).should('have.been.calledOnce');
  });

  it('does not block clicks on interactive content when dragHandleRegion is full', () => {
    const onAction = cy.stub().as('onAction');
    cy.mount(
      <VertListDnd dragHandle dragHandleRegion="full">
        <div>Alpha</div>
        <div>
          <button
            type="button"
            data-cy="item-action-full"
            onClick={() => onAction()}
          >
            Tap me
          </button>
        </div>
      </VertListDnd>
    );

    cy.get('[data-cy="item-action-full"]').should('be.visible').click();
    cy.wrap(onAction).should('have.been.calledOnce');
  });

  it('applies grab cursor to the leading drag handle when dragHandleRegion is top-half', () => {
    cy.mount(
      <VertListDnd dragHandle dragHandleRegion="top-half">
        <div data-cy="row-0">Alpha</div>
      </VertListDnd>
    );

    cy.get('[data-cy="vert-list-dnd-drag-handle"]').should(
      'have.css',
      'cursor',
      'grab'
    );
  });
});
