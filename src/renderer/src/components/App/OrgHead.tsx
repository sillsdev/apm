import { useContext, useMemo, useState } from 'react';
import { LocalKey, localUserKey } from '../../utils/localUserKey';
import { useGlobal } from '../../context/useGlobal';
import {
  IconButton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import UsersIcon from '@mui/icons-material/People';
import { API_CONFIG } from '../../../api-variable';
import { OrganizationD } from '@model/organization';
import TeamDialog, { ITeamDialog } from '../Team/TeamDialog';
import { DialogMode } from '../../model';
import { useCommitTeamSettings } from '../../crud/useCommitTeamSettings';
import { RecordIdentity } from '@orbit/records';
import Confirm from '../AlertDialog';
import { TeamContext } from '../../context/TeamContext';
import { useLocation } from 'react-router-dom';
import BigDialog from '../../hoc/BigDialog';
import { BigDialogBp } from '../../hoc/BigDialogBp';
import GroupTabs from '../GroupTabs';
import { useRole } from '../../crud/useRole';
import { useOrbitData } from '../../hoc/useOrbitData';

export const OrgHead = () => {
  const [user] = useGlobal('user');
  const organizations = useOrbitData<OrganizationD[]>('organization');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<RecordIdentity>();
  const [openMember, setOpenMember] = useState(false);
  const theme = useTheme();
  const isMobileWidth = useMediaQuery(theme.breakpoints.down('sm'));
  const commitTeamSettings = useCommitTeamSettings();
  const { pathname } = useLocation();
  const isTeamScreen = pathname.includes('/team');
  const isSwitchTeamsScreen = pathname.includes('/switch-teams');
  const { userIsOrgAdmin, setMyOrgRole } = useRole();
  const ctx = useContext(TeamContext);
  const { teamDelete, personalTeam } = ctx?.state ?? {};

  const orgId = useMemo(
    () => localStorage.getItem(localUserKey(LocalKey.team)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user]
  );

  const isPersonalTeam = useMemo(() => {
    return personalTeam === orgId;
  }, [personalTeam, orgId]);

  const orgRec = useMemo(() => {
    if (!orgId) return undefined;
    return organizations.find((o) => o.id === orgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, organizations]);

  const isAdmin = useMemo(
    () => userIsOrgAdmin(orgId ?? ''),
    [orgId, userIsOrgAdmin]
  );

  const handleSettings = () => {
    setEditOpen(true);
  };

  const handleCommitSettings = async (
    values: ITeamDialog,
    cb?: (id: string) => Promise<void>
  ) => {
    await commitTeamSettings(values, cb);
    setEditOpen(false);
  };

  const handleDeleteTeam = (team: RecordIdentity) => {
    setDeleteItem(team);
  };

  const handleDeleteConfirmed = async () => {
    deleteItem && teamDelete && (await teamDelete(deleteItem));
    setEditOpen(false);
  };

  const handleDeleteRefused = () => setDeleteItem(undefined);

  const handleMembers = (team: OrganizationD) => () => {
    setMyOrgRole(team.id);
    setOpenMember(true);
  };

  const cleanOrgName = (orgRec: OrganizationD | undefined) => {
    let name = orgRec?.attributes.name;
    if (!name) return '';
    if (name.startsWith('>')) {
      name = name.slice(1);
    }
    if (name.endsWith('<')) {
      name = name.slice(0, -1);
    }
    return name;
  };

  return (
    <Stack direction="row">
      <Typography
        variant="h6"
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: isMobileWidth ? '170px' : '800px',
          alignItems: 'center',
          display: 'flex',
        }}
      >
        {isSwitchTeamsScreen
          ? API_CONFIG.productName
          : cleanOrgName(orgRec) || API_CONFIG.productName}
      </Typography>
      {isTeamScreen && (
        <>
          {isAdmin && (
            <IconButton onClick={handleSettings}>
              <SettingsIcon />
            </IconButton>
          )}
          {orgRec && !isPersonalTeam && (
            <IconButton onClick={handleMembers(orgRec)}>
              <UsersIcon />
            </IconButton>
          )}
        </>
      )}
      {editOpen && orgRec && (
        <TeamDialog
          mode={DialogMode.edit}
          values={{ team: orgRec } as ITeamDialog}
          isOpen={editOpen}
          onOpen={setEditOpen}
          onCommit={handleCommitSettings}
          onDelete={handleDeleteTeam}
        />
      )}
      {deleteItem && (
        <Confirm
          text={''}
          yesResponse={handleDeleteConfirmed}
          noResponse={handleDeleteRefused}
        />
      )}
      <BigDialog
        title={ctx?.state?.cardStrings?.members?.replace(
          '{0}',
          orgRec?.attributes?.name || ''
        )}
        isOpen={openMember}
        onOpen={setOpenMember}
        bp={isMobileWidth ? BigDialogBp.mobile : BigDialogBp.md}
      >
        <GroupTabs />
      </BigDialog>
    </Stack>
  );
};
