import React from 'react';
import { PlayButton } from './PlayButton';

describe('PlayButton', () => {
  let mockOnPlayStatus: ReturnType<typeof cy.stub>;
  let mockOnPlayEnd: ReturnType<typeof cy.stub>;

  beforeEach(() => {
    // Create new stubs for each test
    mockOnPlayStatus = cy.stub().as('onPlayStatus');
    mockOnPlayEnd = cy.stub().as('onPlayEnd');
  });

  it('should render nothing when mediaId is not provided', () => {
    cy.mount(
      <PlayButton
        isPlaying={false}
        onPlayStatus={mockOnPlayStatus}
        onPlayEnd={mockOnPlayEnd}
      />
    );

    // Should not render anything
    cy.get('body').should('not.contain', '[data-testid]');
    cy.get('button').should('not.exist');
  });

  it('should render play button when mediaId is provided and not playing', () => {
    cy.mount(
      <PlayButton
        mediaId="test-media-id"
        isPlaying={false}
        onPlayStatus={mockOnPlayStatus}
        onPlayEnd={mockOnPlayEnd}
      />
    );

    // Should render IconButton with PlayCircleOutline
    cy.get('button[class*="MuiIconButton-root"]').should('be.visible');
    cy.get('svg[data-testid="PlayCircleOutlineIcon"]').should('be.visible');
  });

  it('should call onPlayStatus when play button is clicked', () => {
    cy.mount(
      <PlayButton
        mediaId="test-media-id"
        isPlaying={false}
        onPlayStatus={mockOnPlayStatus}
        onPlayEnd={mockOnPlayEnd}
      />
    );

    cy.get('button[class*="MuiIconButton-root"]').click();
    cy.wrap(mockOnPlayStatus).should('have.been.called');
  });

  it('should render LoadAndPlay component when playing', () => {
    cy.mount(
      <PlayButton
        mediaId="test-media-id"
        isPlaying={true}
        onPlayStatus={mockOnPlayStatus}
        onPlayEnd={mockOnPlayEnd}
      />
    );

    // LoadAndPlay should be rendered (it renders AudioProgressButton)
    // We can't easily test the internal LoadAndPlay rendering without mocking it,
    // but we can verify the play button is no longer visible
    cy.get('svg[data-testid="PlayCircleOutlineIcon"]').should('not.exist');
  });

  it('should apply custom styling when sx prop is provided', () => {
    const customSx = { width: 60, height: 60 };

    cy.mount(
      <PlayButton
        mediaId="test-media-id"
        isPlaying={false}
        onPlayStatus={mockOnPlayStatus}
        onPlayEnd={mockOnPlayEnd}
        sx={customSx}
      />
    );

    // Should render the button (sx is passed to inner components)
    cy.get('button[class*="MuiIconButton-root"]').should('be.visible');
  });

  it('should handle missing onPlayStatus callback gracefully', () => {
    cy.mount(
      <PlayButton
        mediaId="test-media-id"
        isPlaying={false}
        onPlayEnd={mockOnPlayEnd}
      />
    );

    // Should render without error
    cy.get('button[class*="MuiIconButton-root"]').should('be.visible');

    // Clicking should not cause errors (even with undefined callback)
    cy.get('button[class*="MuiIconButton-root"]').click();
  });

  it('should render with default sx values', () => {
    cy.mount(
      <PlayButton
        mediaId="test-media-id"
        isPlaying={false}
        onPlayStatus={mockOnPlayStatus}
        onPlayEnd={mockOnPlayEnd}
      />
    );

    // Should render successfully with default sx (width: 40, height: 40)
    cy.get('button[class*="MuiIconButton-root"]').should('be.visible');
  });

  describe('Different states', () => {
    const testStates = [
      { isPlaying: false, description: 'not playing' },
      { isPlaying: true, description: 'playing' },
    ];

    testStates.forEach(({ isPlaying, description }) => {
      it(`should handle ${description} state correctly`, () => {
        cy.mount(
          <PlayButton
            mediaId="test-media-id"
            isPlaying={isPlaying}
            onPlayStatus={mockOnPlayStatus}
            onPlayEnd={mockOnPlayEnd}
          />
        );

        if (isPlaying) {
          // When playing, should not show the play icon
          cy.get('svg[data-testid="PlayCircleOutlineIcon"]').should(
            'not.exist'
          );
        } else {
          // When not playing, should show the play icon
          cy.get('button[class*="MuiIconButton-root"]').should('be.visible');
          cy.get('svg[data-testid="PlayCircleOutlineIcon"]').should(
            'be.visible'
          );
        }
      });
    });
  });
});
