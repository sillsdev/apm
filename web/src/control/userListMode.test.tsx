jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
  shallowEqual: jest.fn(),
}));

import { fireEvent, render, screen } from '@testing-library/react';
import { useSelector } from 'react-redux';
import { ListMode } from './ListMode';
import { UserListMode } from './userListMode';

const mockUseSelector = useSelector as unknown as jest.Mock;

describe('UserListMode', () => {
  beforeEach(() => {
    mockUseSelector.mockReturnValue({
      logOut: 'Log Out',
      switchUser: 'Work Online',
      workOffline: 'Work Offline',
    });
  });

  it('shows connection modes as tabs', () => {
    const onMode = jest.fn();
    render(
      <UserListMode
        mode={ListMode.SwitchUser}
        onMode={onMode}
        loggedIn
        allowOffline
      />
    );

    expect(screen.getByRole('tab', { name: 'Work Online' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    const logOut = screen.getByRole('tab', { name: 'Log Out' });
    expect(logOut).toHaveAttribute('aria-selected', 'false');
    expect(screen.queryByRole('button', { name: 'Log Out' })).toBeNull();

    fireEvent.click(logOut);
    expect(onMode).toHaveBeenCalledWith(ListMode.LogOut);
  });
});
