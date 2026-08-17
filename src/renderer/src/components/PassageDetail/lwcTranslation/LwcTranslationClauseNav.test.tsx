import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import LwcTranslationClauseNav from './LwcTranslationClauseNav';

jest.mock('../../../selector', () => ({
  lwcTranslationSelector: jest.fn(),
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({
    clauseIndex: 'Clause {0}/{1}',
    progress: '{0} of {1} clauses recorded',
  }),
  shallowEqual: jest.fn(),
}));

describe('LwcTranslationClauseNav', () => {
  const baseProps = {
    currentIndex: 3,
    totalClauses: 12,
    currentClauseRecorded: true,
    navigationDisabled: false,
    onPrev: jest.fn(),
    onNext: jest.fn(),
  };

  it('shows the clause label', () => {
    render(<LwcTranslationClauseNav {...baseProps} />);
    expect(screen.getByText('Clause 4/12')).toBeInTheDocument();
  });

  it('no longer renders the progress indicator inline (moved to player)', () => {
    render(<LwcTranslationClauseNav {...baseProps} />);
    expect(
      document.querySelector('[data-cy="bold-clause-progress"]')
    ).toBeNull();
  });
});
