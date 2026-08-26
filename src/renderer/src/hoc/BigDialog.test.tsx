import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

jest.mock('../context/useGlobal', () => ({
  useGlobal: () => [false, jest.fn()],
  useGetGlobal: () => () => false,
}));

jest.mock('react-redux', () => ({
  useSelector: () => ({
    wait: 'Please wait',
    close: 'Close',
    cancel: 'Cancel',
    save: 'Save',
  }),
  shallowEqual: jest.fn(),
}));

jest.mock('./SnackBar', () => ({
  useSnackBar: () => ({ showMessage: jest.fn() }),
}));

jest.mock('../control', () => ({
  Button: ({
    children,
    ...rest
  }: {
    children: React.ReactNode;
  }) => (
    <button type="button" {...rest}>
      {children}
    </button>
  ),
  GrowingSpacer: () => <div data-testid="growing-spacer" />,
  // rowSx is a theme callback needing the app theme augmentation; the plain
  // object keeps the Box happy without a ThemeProvider.
  rowSx: {},
}));

jest.mock('../selector', () => ({
  sharedSelector: jest.fn(),
}));

import BigDialog from './BigDialog';

afterEach(() => {
  cleanup();
});

describe('BigDialog title (TT-7538)', () => {
  it('keeps the title on one line with a native title tooltip', () => {
    const longTitle =
      'Provide audio for Matthew 1:1-25 — a very long dialog title';
    render(
      <BigDialog title={longTitle} isOpen={true} onOpen={() => {}}>
        <div>body</div>
      </BigDialog>
    );
    const title = screen.getByText(longTitle);
    expect(title.getAttribute('title')).toBe(longTitle);
    expect(title).toHaveStyle({
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
  });
});
