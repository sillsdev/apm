import React from 'react';
import { render, screen } from '@testing-library/react';
import PassageDetailMarkVersesIsMobile from './PassageDetailMarkVersesIsMobile';

const mockDesktop = jest.fn(() => <div data-testid="desktop-mark-verses" />);

jest.mock('../../PassageDetailMarkVerses', () => ({
  __esModule: true,
  default: (props: { width: number }) => mockDesktop(props),
}));

describe('PassageDetailMarkVersesIsMobile', () => {
  beforeEach(() => {
    mockDesktop.mockClear();
  });

  it('forwards props to desktop component', () => {
    render(<PassageDetailMarkVersesIsMobile width={320} />);

    expect(mockDesktop).toHaveBeenCalled();
    expect(mockDesktop.mock.calls[0][0]).toEqual({ width: 320 });
    expect(screen.getByTestId('desktop-mark-verses')).toBeInTheDocument();
  });
});
