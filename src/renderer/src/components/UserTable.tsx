import React, { useState, useEffect, useMemo } from 'react';
import { useGlobal } from '../context/useGlobal';
import { localizeRole, LocalKey, localUserKey, restoreScroll } from '../utils';
import { shallowEqual } from 'react-redux';
import {
  User,
  RoleD,
  OrganizationMembership,
  IUsertableStrings,
  ISharedStrings,
  RoleNames,
  UserD,
} from '../model';
import { IconButton, Box } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import { Table } from '@devexpress/dx-react-grid-material-ui';
import Invite from './Invite';
import Confirm from './AlertDialog';
import ShapingTable from './ShapingTable';
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
import { useSelector } from 'react-redux';
import { sharedSelector, usertableSelector } from '../selector';
import { RecordIdentity } from '@orbit/records';
import { useOrbitData } from '../hoc/useOrbitData';
import ProfileDialog from './ProfileDialog';

interface IRow {
  type: string;
  name: string;
  email: string;
  locale: string;
  // phone: string;
  timezone: string;
  role: string;
  action: string;
  id: RecordIdentity;
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
  const columnDefs = [
    { name: 'name', title: t.name },
    { name: 'email', title: t.email },
    { name: 'locale', title: t.locale },
    // { name: 'phone', title: t.phone },
    { name: 'timezone', title: t.timezone },
    { name: 'role', title: ts.teamrole },
    {
      name: 'action',
      title: userIsAdmin ? t.action : '\u00A0',
    },
  ];
  const columnWidths = [
    { columnName: 'name', width: 200 },
    { columnName: 'email', width: 200 },
    { columnName: 'locale', width: 100 },
    // { columnName: 'phone', width: 100 },
    { columnName: 'timezone', width: 100 },
    { columnName: 'role', width: 100 },
    { columnName: 'action', width: 150 },
  ];
  const sortingEnabled = [{ columnName: 'action', sortingEnabled: false }];
  const filteringEnabled = [{ columnName: 'action', filteringEnabled: false }];
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

  const isCurrentUser = (userId: string) => userId === user;

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
              id: { type: 'user', id: firstUser.id },
            } as IRow);
          }
        }
      });
      return rowData;
    };
    setData(getMedia());
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [organization, users, roles, organizationMemberships]);

  interface ICell {
    value: string;
    style?: React.CSSProperties;
    row: IRow;
    column: any;
    tableRow: any;
    tableColumn: any;
  }

  const ActionCell = ({ value, style, ...restProps }: ICell) => (
    <Table.Cell {...restProps} style={{ ...style }} value>
      <>
        <IconButton
          id={'edit-' + value}
          key={'edit-' + value}
          aria-label={'edit-' + value}
          color="default"
          onClick={handleEdit(value)}
          disabled={isCurrentUser(value)}
        >
          <EditIcon />
        </IconButton>
        <IconButton
          id={'del-' + value}
          key={'del-' + value}
          aria-label={'del-' + value}
          color="default"
          onClick={handleDelete(value)}
          disabled={
            userIsAdmin
              ? admins.length === 1 && isCurrentUser(value)
              : !isCurrentUser(value)
          }
        >
          <DeleteIcon />
        </IconButton>
      </>
    </Table.Cell>
  );
  const admins = useMemo(
    () => data.filter((d) => d.role === RoleNames.Admin),
    [data]
  );
  const canEdit = useMemo(
    () => userIsAdmin && (!offline || offlineOnly),
    [userIsAdmin, offline, offlineOnly]
  );

  const canEditOrcanDeleteSelf = useMemo(
    () => (value: string) =>
      (userIsAdmin || isCurrentUser(value)) && (!offline || offlineOnly),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offline, offlineOnly, userIsAdmin]
  );

  const Cell = (props: any) => {
    const { column } = props;
    if (column.name === 'action') {
      if (canEditOrcanDeleteSelf(props.value)) return <ActionCell {...props} />;
      else return <></>;
    }
    return <Table.Cell {...props} />;
  };

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
        <ShapingTable
          columns={columnDefs}
          columnWidths={columnWidths}
          sortingEnabled={sortingEnabled}
          filteringEnabled={filteringEnabled}
          dataCell={Cell}
          rows={data}
        />
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
