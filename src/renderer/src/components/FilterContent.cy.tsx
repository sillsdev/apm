import React from 'react';
import FilterContent from './FilterContent';
import { FilterData } from './FilterContent';

describe('FilterContent', () => {
  const mockFilterData: FilterData = {
    label: 'Test Project',
    books: [
      {
        label: 'Matthew',
        chapters: ['1', '2', '3'],
        burritos: ['Audio', 'Scripture'],
      },
      {
        label: 'Luke',
        chapters: ['1', '2'],
        burritos: ['Audio'],
      },
    ],
  };

  beforeEach(() => {
    cy.viewport(800, 600);
  });

  it('should render dialog with project label', () => {
    const onSubmit = cy.stub();
    const onVisible = cy.stub();

    cy.mount(
      <FilterContent
        visible={true}
        onVisible={onVisible}
        onSubmit={onSubmit}
        filterData={mockFilterData}
      />
    );

    cy.contains('Scripture Burrito: Test Project').should('be.visible');
  });

  it('should show instructions text', () => {
    const onSubmit = cy.stub();
    const onVisible = cy.stub();

    cy.mount(
      <FilterContent
        visible={true}
        onVisible={onVisible}
        onSubmit={onSubmit}
        filterData={mockFilterData}
      />
    );

    cy.contains('Please select the information you want to import').should(
      'be.visible'
    );
  });

  it('should render tree with books', () => {
    const onSubmit = cy.stub();
    const onVisible = cy.stub();

    cy.mount(
      <FilterContent
        visible={true}
        onVisible={onVisible}
        onSubmit={onSubmit}
        filterData={mockFilterData}
      />
    );

    cy.contains('Matthew').should('be.visible');
    cy.contains('Luke').should('be.visible');
  });

  it('should have upload button', () => {
    const onSubmit = cy.stub();
    const onVisible = cy.stub();

    cy.mount(
      <FilterContent
        visible={true}
        onVisible={onVisible}
        onSubmit={onSubmit}
        filterData={mockFilterData}
      />
    );

    cy.contains('button', 'Upload').should('be.visible');
  });

  it('should not render when visible is false', () => {
    const onSubmit = cy.stub();
    const onVisible = cy.stub();

    cy.mount(
      <FilterContent
        visible={false}
        onVisible={onVisible}
        onSubmit={onSubmit}
        filterData={mockFilterData}
      />
    );

    cy.contains('Scripture Burrito: Test Project').should('not.exist');
  });

  it('should handle empty books array', () => {
    const emptyFilterData: FilterData = {
      label: 'Empty Project',
      books: [],
    };

    const onSubmit = cy.stub();
    const onVisible = cy.stub();

    cy.mount(
      <FilterContent
        visible={true}
        onVisible={onVisible}
        onSubmit={onSubmit}
        filterData={emptyFilterData}
      />
    );

    cy.contains('Scripture Burrito: Empty Project').should('be.visible');
  });
});
