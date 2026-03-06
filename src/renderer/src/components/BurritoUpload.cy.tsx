import React from 'react';
import BurritoUploadDialog from './BurritoUpload';

describe('BurritoUploadDialog', () => {
  beforeEach(() => {
    cy.viewport(800, 600);
  });

  it('should render dialog with correct title', () => {
    const onSubmit = cy.stub();
    const onCancel = cy.stub();

    cy.mount(
      <BurritoUploadDialog
        open={true}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    cy.contains('Import Scripture Burrito').should('be.visible');
  });

  it('should show browse buttons', () => {
    const onSubmit = cy.stub();
    const onCancel = cy.stub();

    cy.mount(
      <BurritoUploadDialog
        open={true}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    cy.contains('Browse Directory').should('be.visible');
    cy.contains('Browse Zip File').should('be.visible');
  });

  it('should have cancel and import buttons', () => {
    const onSubmit = cy.stub();
    const onCancel = cy.stub();

    cy.mount(
      <BurritoUploadDialog
        open={true}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    cy.contains('Cancel').should('be.visible');
    cy.contains('Import').should('be.visible');
  });

  it('should disable import button when nothing selected', () => {
    const onSubmit = cy.stub();
    const onCancel = cy.stub();

    cy.mount(
      <BurritoUploadDialog
        open={true}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    cy.contains('button', 'Import').should('be.disabled');
  });

  it('should render with custom title', () => {
    const onSubmit = cy.stub();
    const onCancel = cy.stub();

    cy.mount(
      <BurritoUploadDialog
        open={true}
        onSubmit={onSubmit}
        onCancel={onCancel}
        title="Custom Title"
      />
    );

    cy.contains('Custom Title').should('be.visible');
  });

  it('should not render when open is false', () => {
    const onSubmit = cy.stub();
    const onCancel = cy.stub();

    cy.mount(
      <BurritoUploadDialog
        open={false}
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );

    cy.contains('Import Scripture Burrito').should('not.exist');
  });
});
