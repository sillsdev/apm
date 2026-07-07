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
    completedCount: 4,
    currentClauseRecorded: true,
    navigationDisabled: false,
    onPrev: jest.fn(),
    onNext: jest.fn(),
  };

  it('shows clause label and progress count', () => {
    render(<LwcTranslationClauseNav {...baseProps} />);
    expect(screen.getByText('Clause 4/12')).toBeInTheDocument();
    expect(screen.getByText('4/12')).toBeInTheDocument();
  });

  it('renders determinate circular progress', () => {
    render(<LwcTranslationClauseNav {...baseProps} />);
    const progress = document.querySelector('[data-cy="lwc-clause-progress"]');
    expect(progress).toBeTruthy();
    const rings = progress?.querySelectorAll('.MuiCircularProgress-root');
    expect(rings?.length).toBe(2);
    expect(
      progress?.querySelector('.MuiCircularProgress-determinate')
    ).toBeTruthy();
  });
});
