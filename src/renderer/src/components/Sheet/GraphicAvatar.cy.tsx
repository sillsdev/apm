import React from 'react';
import { GraphicAvatar } from './GraphicAvatar';

describe('GraphicAvatar', () => {
  let mockOnClick: ReturnType<typeof cy.stub>;

  beforeEach(() => {
    // Create a new stub for each test
    mockOnClick = cy.stub().as('onClick');
  });

  it('should render with graphicUri when provided', () => {
    const graphicUri = 'https://example.com/image.png';
    cy.mount(
      <GraphicAvatar
        graphicUri={graphicUri}
        sectionSeq={1}
        organizedBy="Chapter"
        onClick={mockOnClick}
      />
    );

    // Should render an Avatar with the image source
    cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
    cy.get('img').should('have.attr', 'src', graphicUri);
  });

  it('should render with text avatar when graphicUri is not provided', () => {
    cy.mount(
      <GraphicAvatar
        sectionSeq={1}
        organizedBy="Chapter"
        onClick={mockOnClick}
      />
    );

    // Should render an Avatar with text (initials)
    cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
    // Should contain text content (initials from "Chapter 1")
    cy.get('div[class*="MuiAvatar-root"]').should('contain.text', 'C');
  });

  it('should use reference when provided instead of organizedBy and sectionSeq', () => {
    cy.mount(
      <GraphicAvatar
        reference="Gen 1:1"
        sectionSeq={1}
        organizedBy="Chapter"
        onClick={mockOnClick}
      />
    );

    // Should use reference for the label
    cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
    // Should contain initials from "Gen 1:1" (G and 1)
    cy.get('div[class*="MuiAvatar-root"]').should('contain.text', 'G');
  });

  it('should use organizedBy and sectionSeq when reference is not provided', () => {
    cy.mount(
      <GraphicAvatar
        sectionSeq={5}
        organizedBy="Section"
        onClick={mockOnClick}
      />
    );

    // Should use "Section 5" for the label
    cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
    // Should contain initials from "Section 5" (S and 5)
    cy.get('div[class*="MuiAvatar-root"]').should('contain.text', 'S');
  });

  it('should render empty text avatar when organizedBy is empty and no reference', () => {
    cy.mount(
      <GraphicAvatar sectionSeq={1} organizedBy="" onClick={mockOnClick} />
    );

    // Should render an Avatar but with empty text since organizedBy is empty
    cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
    // Avatar should exist but may have no text content
    cy.get('div[class*="MuiAvatar-root"]').should('exist');
  });

  it('should call onClick when avatar is clicked', () => {
    cy.mount(
      <GraphicAvatar
        sectionSeq={1}
        organizedBy="Chapter"
        onClick={mockOnClick}
      />
    );

    cy.get('div[class*="MuiAvatar-root"]').click();
    cy.wrap(mockOnClick).should('have.been.called');
  });

  it('should apply custom style when provided', () => {
    const customStyle = { width: '100px', height: '100px' };
    cy.mount(
      <GraphicAvatar
        sectionSeq={1}
        organizedBy="Chapter"
        style={customStyle}
        onClick={mockOnClick}
      />
    );

    cy.get('div[class*="MuiAvatar-root"]')
      .should('have.css', 'width', '100px')
      .and('have.css', 'height', '100px');
  });

  it('should render with rounded variant', () => {
    cy.mount(
      <GraphicAvatar
        sectionSeq={1}
        organizedBy="Chapter"
        onClick={mockOnClick}
      />
    );

    // MUI Avatar with variant="rounded" should have rounded corners
    cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
    // Check for rounded variant class or border-radius
    cy.get('div[class*="MuiAvatar-root"]').should('have.css', 'border-radius');
  });

  it('should have cursor pointer style', () => {
    cy.mount(
      <GraphicAvatar
        sectionSeq={1}
        organizedBy="Chapter"
        onClick={mockOnClick}
      />
    );

    cy.get('div[class*="MuiAvatar-root"]').should(
      'have.css',
      'cursor',
      'pointer'
    );
  });

  it('should prioritize graphicUri over reference and organizedBy', () => {
    const graphicUri = 'https://example.com/image.png';
    cy.mount(
      <GraphicAvatar
        graphicUri={graphicUri}
        reference="Gen 1:1"
        sectionSeq={1}
        organizedBy="Chapter"
        onClick={mockOnClick}
      />
    );

    // Should show image, not text
    cy.get('img').should('have.attr', 'src', graphicUri);
    // Should not contain text initials
    cy.get('div[class*="MuiAvatar-root"]').should('not.contain.text', 'G');
  });

  it('should handle empty reference and use organizedBy and sectionSeq', () => {
    cy.mount(
      <GraphicAvatar
        reference=""
        sectionSeq={2}
        organizedBy="Verse"
        onClick={mockOnClick}
      />
    );

    // Empty reference should be falsy, so should use "Verse 2"
    cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
    cy.get('div[class*="MuiAvatar-root"]').should('contain.text', 'V');
  });

  it('should handle sectionSeq of 0', () => {
    cy.mount(
      <GraphicAvatar
        sectionSeq={0}
        organizedBy="Chapter"
        onClick={mockOnClick}
      />
    );

    // Should use "Chapter 0" for the label
    cy.get('div[class*="MuiAvatar-root"]').should('be.visible');
    cy.get('div[class*="MuiAvatar-root"]').should('contain.text', 'C');
  });
});
