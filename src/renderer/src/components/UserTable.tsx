import React, { useState, useEffect, useMemo } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import {
  User,
  RoleD,
  OrganizationMembership,
  IUsertableStrings,
  ISharedStrings,
  RoleNames,
  UserD,
} from '../model';
import Box from '@mui/material/Box';
import AddIcon from '@mui/icons-material/Add';
import { useGlobal } from '../context/useGlobal';
import { localizeRole, LocalKey, localUserKey, restoreScroll } from '../utils';
import Invite from './Invite';
import Confirm from './AlertDialog';
import UserAdd from './UserAdd';
import {
  related,
  RemoveUserFromOrg,
  useAddToOrgAndGroup,
  useTeamDelete,
  useUser,
  useRole,
} from '../crud';
import { GrowingSpacer, PriButton, ActionRow, iconMargin } from '../control';
import { sharedSelector, usertableSelector } from '../selector';
import { useOrbitData } from '../hoc/useOrbitData';
import ProfileDialog from './ProfileDialog';
import UserActionCell from './UserActionCell';

export interface IRow {
  type: string;
  name: string;
  email: string;
  locale: string;
  timezone: string;
  role: string;
  action: string;
  id: string;
}

const getUser = (om: OrganizationMembership, users: User[]) => {
  return users.filter((u) => u.id === related(om, 'user'));
};
const getName = (om: OrganizationMembership, users: User[]) => {
  const u = getUser(om, users) as UserD[];
  const firstUser = u[0] as UserD;
  return u && u.length > 0 && firstUser.attributes && firstUser.attributes.name;
};

export function UserTable() {
  const users = useOrbitData<User[]>('user');
  const roles = useOrbitData<RoleD[]>('role');
  const organizationMemberships = useOrbitData<OrganizationMembership[]>(
    'organizationmembership'
  );
  const t: IUsertableStrings = useSelector(usertableSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  // const { pathname } = useLocation();
  const [organization] = useGlobal('organization');
  const [user] = useGlobal('user');
  const [memory] = useGlobal('memory');
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const { getUserRec } = useUser();
  const [data, setData] = useState(Array<IRow>());
  const { userIsAdmin } = useRole();
  const [profileOpen, setProfileOpen] = React.useState(false);
  const [deleteItem, setDeleteItem] = useState('');
  const [dialogVisible, setDialogVisible] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const addToOrgAndGroup = useAddToOrgAndGroup();
  const teamDelete = useTeamDelete();

  const handleInvite = () => {
    setDialogVisible(true);
  };
  const handleInviteComplete = async () => {
    setDialogVisible(false);
  };

  const handleInviteCancel = () => {
    setDialogVisible(false);
  };

  const handleProfile = (visible: boolean) => () => {
    if (visible !== profileOpen) setProfileOpen(visible);
    restoreScroll();
    setAnchorEl(null);
  };

  const doEdit = (userId: string) => {
    setEditId(userId);
    //setView('Profile');//CreateProfile ??
    //handleProfile(true);
    // TODO: Figure out why running this code in handleProfile doesn't work
    if (true !== profileOpen) setProfileOpen(true);
    restoreScroll();
    setAnchorEl(null);
  };

  const handleEdit = (userId: string) => () => {
    doEdit(userId);
  };

  const handleAddOpen = () => {
    setAddOpen(true);
  };

  const handleSetAddOpen = (val: boolean) => {
    setAddOpen(val);
  };

  const handleAddNew = () => {
    setAddOpen(false);
    doEdit('Add');
  };

  const handleAddExisting = (userId: string) => () => {
    setAddOpen(false);
    const userRec = users.find((u) => u?.id === userId);
    if (userRec) addToOrgAndGroup(userRec, false);
  };

  const handleDelete = (value: string) => () => {
    setDeleteItem(value);
  };
  const handleDeleteConfirmed = () => {
    const deleteRec = getUserRec(deleteItem);
    RemoveUserFromOrg(memory, deleteRec, organization, user, teamDelete);
    localStorage.setItem(localUserKey(LocalKey.url), '/');
    setDeleteItem('');
  };

  const handleDeleteRefused = () => {
    setDeleteItem('');
  };

  useEffect(() => {
    const getMedia = () => {
      const members = organizationMemberships
        .filter((om) => related(om, 'organization') === organization)
        .sort((i, j) => (getName(i, users) <= getName(j, users) ? -1 : 1));
      const rowData: IRow[] = [];
      members.forEach((m) => {
        const user = getUser(m, users);
        const role = roles.find((r) => r.id === related(m, 'role'));
        if (user.length === 1) {
          const firstUser = user[0] as UserD;
          if (firstUser.attributes) {
            rowData.push({
              name: firstUser.attributes.name,
              email: firstUser.attributes.email
                ? firstUser.attributes.email.toLowerCase()
                : t.addMember,
              locale: firstUser.attributes.locale
                ? firstUser.attributes.locale
                : '',
              // phone: u.attributes.phone ? u.attributes.phone : '',
              timezone: firstUser.attributes.timezone
                ? firstUser.attributes.timezone
                : '',
              role: localizeRole(
                role ? role.attributes.roleName : RoleNames.Member,
                ts
              ),
              action: firstUser.id,
              id: firstUser.id,
            } as IRow);
          }
        }
      });
      return rowData;
    };
    setData(getMedia());
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [organization, users, roles, organizationMemberships]);

  const admins = useMemo(
    () => data.filter((d) => d.role === RoleNames.Admin),
    [data]
  );
  const canEdit = useMemo(
    () => userIsAdmin && (!offline || offlineOnly),
    [userIsAdmin, offline, offlineOnly]
  );

  const columns: GridColDef<IRow>[] = [
    { field: 'name', headerName: t.name, width: 200 },
    { field: 'email', headerName: t.email, width: 200 },
    { field: 'locale', headerName: t.locale, width: 100 },
    { field: 'timezone', headerName: t.timezone, width: 100 },
    { field: 'role', headerName: ts.teamrole, width: 100 },
    {
      field: 'action',
      headerName: userIsAdmin ? t.action : '\u00A0',
      width: 150,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <UserActionCell
          {...params}
          handleEdit={handleEdit}
          handleDelete={handleDelete}
          admins={admins}
        />
      ),
    },
  ];

  return (
    <Box sx={{ display: 'flex' }}>
      <div>
        <ActionRow>
          {canEdit && (
            <>
              {!offlineOnly && (
                <PriButton
                  key="add"
                  aria-label={t.invite}
                  onClick={handleInvite}
                >
                  {t.invite}
                  <AddIcon sx={iconMargin} />
                </PriButton>
              )}
              {offlineOnly && (
                <PriButton
                  key="add-member"
                  aria-label={t.addMember}
                  onClick={handleAddOpen}
                >
                  {t.addMember}
                  <AddIcon sx={iconMargin} />
                </PriButton>
              )}
            </>
          )}
          <GrowingSpacer />
        </ActionRow>
        <DataGrid columns={columns} rows={data} />
      </div>
      <Invite
        visible={dialogVisible}
        inviteIn={null}
        addCompleteMethod={handleInviteComplete}
        cancelMethod={handleInviteCancel}
      />
      <UserAdd
        open={addOpen}
        setOpen={handleSetAddOpen}
        select={handleAddExisting}
        add={handleAddNew}
      />
      {deleteItem !== '' ? (
        <Confirm
          text={''}
          yesResponse={handleDeleteConfirmed}
          noResponse={handleDeleteRefused}
        />
      ) : (
        <></>
      )}
      <ProfileDialog
        mode="editMember"
        open={profileOpen}
        onClose={handleProfile(false)}
        onCancel={handleProfile(false)}
        onSave={handleProfile(false)}
        editId={editId}
      />
    </Box>
  );
}

export default UserTable;
