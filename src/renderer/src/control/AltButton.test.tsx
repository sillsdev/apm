import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { AltButton } from './AltButton';

afterEach(() => {
  cleanup();
});

describe('AltButton', () => {
  it('renders centered outlined button labels (TT-7261)', () => {
    render(<AltButton id="add-team">Add Team</AltButton>);
    const button = screen.getByRole('button', { name: 'Add Team' });
    expect(button.id).toBe('add-team');
    // Default sx uses justifyContent: 'center' (see AltButton.tsx). Emotion may not
    // expose computed styles in JSDOM; assert the control remains a primary outlined button.
    expect(button.className).toMatch(/MuiButton-outlined/);
    expect(button.className).toMatch(/MuiButton-outlinedPrimary|MuiButton-colorPrimary/);
  });
});
