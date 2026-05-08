import React from 'react';
import { render, screen } from '@testing-library/react';
import UserActionCell from './UserActionCell';
import type { GridRenderCellParams } from '@mui/x-data-grid';
import type { IRow } from './UserTable';

jest.mock('../context/useGlobal', () => ({
  useGlobal: (key: string) =>
    key === 'user' ? ['admin-id', jest.fn()] : [null, jest.fn()],
}));

jest.mock('../crud/useRole', () => ({
  useRole: () => ({ userIsAdmin: true }),
}));

const baseParams = {
  id: 'other-user',
  field: 'action',
  value: 'other-user',
  row: { id: 'other-user' } as IRow,
  colDef: { field: 'action' },
  api: {} as GridRenderCellParams<IRow>['api'],
  hasFocus: false,
  tabIndex: 0,
} as GridRenderCellParams<IRow>;

describe('UserActionCell', () => {
  it('disables edit and delete when memberActionsEnabled is false (offline / offline-only)', () => {
    render(
      <UserActionCell
        {...baseParams}
        handleEdit={() => () => {}}
        handleDelete={() => () => {}}
        admins={[{ id: 'other-user', role: 'Admin' } as IRow]}
        memberActionsEnabled={false}
      />
    );
    expect(screen.getByLabelText('edit-other-user')).toBeDisabled();
    expect(screen.getByLabelText('del-other-user')).toBeDisabled();
  });

  it('allows edit and delete for another user when admin and memberActionsEnabled', () => {
    render(
      <UserActionCell
        {...baseParams}
        handleEdit={() => () => {}}
        handleDelete={() => () => {}}
        admins={[
          { id: 'admin-id', role: 'Admin' } as IRow,
          { id: 'other-user', role: 'Admin' } as IRow,
        ]}
        memberActionsEnabled
      />
    );
    expect(screen.getByLabelText('edit-other-user')).not.toBeDisabled();
    expect(screen.getByLabelText('del-other-user')).not.toBeDisabled();
  });
});
