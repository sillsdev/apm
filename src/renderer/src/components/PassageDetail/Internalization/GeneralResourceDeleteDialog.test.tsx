import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import GeneralResourceDeleteDialog from './GeneralResourceDeleteDialog';

jest.mock('react-redux', () => ({
  shallowEqual: (a: unknown, b: unknown) => a === b,
  useSelector: () => ({
    cancel: 'Cancel',
    confirmDeleteTitle: 'Confirm Delete',
    deleteAll: 'Delete All {0}',
    deleteGeneralResource:
      'Do you want to delete the entire general resource or just this one?',
    deleteJustThisOne: 'Delete Just This One',
    generalResourceSplit: '{0} is split into {1} resources',
  }),
}));

jest.mock('../../../selector', () => ({
  passageDetailArtifactsSelector: jest.fn(),
  sharedSelector: jest.fn(),
}));

jest.mock('../../../utils/useMobile', () => ({
  useMobile: () => ({ isMobile: false }),
}));

jest.mock('../../../control/Button', () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

describe('GeneralResourceDeleteDialog', () => {
  const renderDialog = () => {
    const handlers = {
      onCancel: jest.fn(),
      onDeleteAll: jest.fn(),
      onDeleteOne: jest.fn(),
    };
    render(
      <GeneralResourceDeleteDialog
        fileName="genesis.mp3"
        count={3}
        {...handlers}
      />
    );
    return handlers;
  };

  it('names the resource and how many copies it has', () => {
    renderDialog();
    expect(
      screen.getByText('genesis.mp3 is split into 3 resources')
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete All 3' })
    ).toBeInTheDocument();
  });

  it.each([
    ['Cancel', 'onCancel'],
    ['Delete All 3', 'onDeleteAll'],
    ['Delete Just This One', 'onDeleteOne'],
  ] as const)('%s calls only %s', (label, handler) => {
    const handlers = renderDialog();
    fireEvent.click(screen.getByRole('button', { name: label }));
    Object.entries(handlers).forEach(([name, fn]) =>
      expect(fn).toHaveBeenCalledTimes(name === handler ? 1 : 0)
    );
  });
});
