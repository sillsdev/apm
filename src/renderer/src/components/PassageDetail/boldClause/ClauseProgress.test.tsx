import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import ClauseProgress from './ClauseProgress';

describe('ClauseProgress', () => {
  const baseProps = {
    completedCount: 4,
    totalClauses: 12,
    progressLabel: '{0} of {1} clauses recorded',
  };

  it('shows the progress count', () => {
    render(<ClauseProgress {...baseProps} />);
    expect(screen.getByText('4/12')).toBeInTheDocument();
  });

  it('renders determinate circular progress with an aria-label', () => {
    render(<ClauseProgress {...baseProps} />);
    const progress = document.querySelector('[data-cy="bold-clause-progress"]');
    expect(progress).toBeTruthy();
    expect(progress?.getAttribute('aria-label')).toBe(
      '4 of 12 clauses recorded'
    );
    const rings = progress?.querySelectorAll('.MuiCircularProgress-root');
    expect(rings?.length).toBe(2);
    expect(
      progress?.querySelector('.MuiCircularProgress-determinate')
    ).toBeTruthy();
  });

  it('renders nothing when there are no clauses', () => {
    const { container } = render(
      <ClauseProgress {...baseProps} totalClauses={0} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
