import { useState, useEffect, useMemo } from 'react';
import { useGlobal } from '../context/useGlobal';
import { shallowEqual } from 'react-redux';
import {
  RoleD,
  Invitation,
  IInvitationTableStrings,
  ISharedStrings,
} from '../model';
import { Menu, MenuItem, Box } from '@mui/material';
import DropDownIcon from '@mui/icons-material/ArrowDropDown';
import AddIcon from '@mui/icons-material/Add';
import Invite from './Invite';
import { useSnackBar } from '../hoc/SnackBar';
import Confirm from './AlertDialog';
import { related, useRole } from '../crud';
import { localizeRole } from '../utils';

import {
  ActionRow,
  AltButton,
  GrowingSpacer,
  PriButton,
  iconMargin,
} from '../control';
import { useSelector } from 'react-redux';
import { invitationTableSelector, sharedSelector } from '../selector';
import { useOrbitData } from '../hoc/useOrbitData';
import { RecordIdentity } from '@orbit/records';
import {
  DataGrid,
  type GridColDef,
  type GridRowSelectionModel,
} from '@mui/x-data-grid';

interface IRow {
  email: string;
  orgRole: string;
  accepted: string;
  id: RecordIdentity;
}

const getInvites = (
  organization: string,
  roles: RoleD[],
  invitations: Array<Invitation>,
  ts: ISharedStrings
) => {
  const invites = invitations.filter(
    (i) => related(i, 'organization') === organization
  );
  return invites.map((i) => {
    const role = roles.filter((r) => r.id === related(i, 'role'));
    return {
      email: i.attributes.email ? i.attributes.email : '',
      orgRole: localizeRole(
        role.length > 0 ? role[0].attributes.roleName : 'member',
        ts
      ),
      accepted: i.attributes.accepted ? ts.yes : ts.no,
      id: { type: 'invitation', id: i.id },
    } as IRow;
  });
};

export function InvitationTable() {
  const roles = useOrbitData<RoleD[]>('role');
  const invitations = useOrbitData<Invitation[]>('invitation');
  const t: IInvitationTableStrings = useSelector(
    invitationTableSelector,
    shallowEqual
  );
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const [organization] = useGlobal('organization');
  const [memory] = useGlobal('memory');
  const { showMessage } = useSnackBar();
  const [data, setData] = useState(Array<IRow>());
  const [actionMenuItem, setActionMenuItem] = useState(null);
  const [check, setCheck] = useState(Array<number>());
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>({
    type: 'include',
    ids: new Set(),
  });
  const [confirmAction, setConfirmAction] = useState('');
  const columns: GridColDef[] = [
    { field: 'email', headerName: t.email, width: 200 },
    { field: 'orgRole', headerName: t.role, width: 200 },
    { field: 'accepted', headerName: t.accepted, width: 120 },
  ];
  const [dialogVisible, setDialogVisible] = useState(false);
  const [dialogData, setDialogData] = useState<Invitation | null>(null);
  const [offline] = useGlobal('offline');
  const { userIsAdmin } = useRole();

  const handleAdd = () => {
    setDialogData(null);
    setDialogVisible(true);
  };
  const handleAddComplete = async () => {
    setDialogVisible(false);
  };

  const handleAddCancel = () => {
    setDialogVisible(false);
  };

  const handleRowSelectionChange = (newSelection: GridRowSelectionModel) => {
    let checks = Array.from(newSelection.ids).map((id) =>
      parseInt(id as string)
    );
    if (newSelection.type === 'exclude') {
      checks = [];
      data.forEach((_r, i) => {
        if (!newSelection.ids.has(i)) checks.push(i);
      });
    }
    setCheck(checks);
    setSelectedRows(newSelection);
  };
  const handleMenu = (e: any) => setActionMenuItem(e.currentTarget);
  const handleConfirmAction = (what: string) => () => {
    setActionMenuItem(null);
    if (!/Close/i.test(what)) {
      if (check.length === 0) {
        showMessage(t.selectRows.replace('{0}', what));
      } else {
        setConfirmAction(what);
      }
    }
  };
  const handleActionConfirmed = () => {
    if (confirmAction === 'Delete') {
      setCheck(Array<number>());
      check.forEach((i) => {
        memory.update((t) => t.removeRecord(data[i].id));
      });
    }
    setConfirmAction('');
  };
  const handleActionRefused = () => {
    setConfirmAction('');
  };

  useEffect(() => {
    setData(getInvites(organization, roles, invitations, ts));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organization, roles, invitations, confirmAction, ts]);

  const canEdit = useMemo(
    () => userIsAdmin && !offline,
    [offline, userIsAdmin]
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <div>
        <ActionRow>
          {canEdit && (
            <>
              <PriButton
                id="inviteAdd"
                key="add"
                aria-label={t.invite}
                onClick={handleAdd}
              >
                {t.invite}
                <AddIcon sx={iconMargin} />
              </PriButton>
              <AltButton
                id="inviteAction"
                key="action"
                aria-owns={actionMenuItem !== '' ? 'action-menu' : undefined}
                aria-label={t.action}
                onClick={handleMenu}
              >
                {t.action}
                <DropDownIcon sx={iconMargin} />
              </AltButton>
              <Menu
                id="action-menu"
                anchorEl={actionMenuItem}
                open={Boolean(actionMenuItem)}
                onClose={handleConfirmAction('Close')}
              >
                <MenuItem
                  id="inviteDelete"
                  onClick={handleConfirmAction(t.delete)}
                >
                  {t.delete}
                </MenuItem>
              </Menu>
            </>
          )}
          <GrowingSpacer />
        </ActionRow>
        <DataGrid
          columns={columns}
          rows={data.map((row, i) => ({ ...row, id: i }))}
          checkboxSelection
          rowSelectionModel={selectedRows}
          onRowSelectionModelChange={handleRowSelectionChange}
          localeText={{ noRowsLabel: t.noData }}
        />
      </div>
      <Invite
        visible={dialogVisible}
        inviteIn={
          dialogData
            ? {
                email: dialogData.attributes.email.toLowerCase(),
                role: related(dialogData, 'role'),
              }
            : null
        }
        addCompleteMethod={handleAddComplete}
        cancelMethod={handleAddCancel}
      />
      {confirmAction !== '' ? (
        <Confirm
          text={confirmAction + ' ' + check.length + ' Item(s). Are you sure?'}
          yesResponse={handleActionConfirmed}
          noResponse={handleActionRefused}
        />
      ) : (
        <></>
      )}
    </Box>
  );
}

export default InvitationTable;
