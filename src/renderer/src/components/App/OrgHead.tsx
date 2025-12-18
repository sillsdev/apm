import { useContext, useMemo, useState } from 'react';
import { LocalKey, localUserKey } from '../../utils/localUserKey';
import { useGlobal } from '../../context/useGlobal';
import {
  IconButton,
  Menu,
  MenuItem,
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
import { StepEditor } from '../StepEditor';
import { defaultWorkflow } from '../../crud';
import { useRole } from '../../crud/useRole';
import { useOrbitData } from '../../hoc/useOrbitData';
import { ProjectSort } from '../Team/ProjectDialog/ProjectSort';

export const OrgHead = () => {
  const [user] = useGlobal('user');
  const organizations = useOrbitData<OrganizationD[]>('organization');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<RecordIdentity>();
  const [openMember, setOpenMember] = useState(false);
  const [settingsMenuEl, setSettingsMenuEl] = useState<null | HTMLElement>(
    null
  );
  const [sortVisible, setSortVisible] = useState(false);
  const [workflowVisible, setWorkflowVisible] = useState(false);
  const theme = useTheme();
  const isMobileWidth = useMediaQuery(theme.breakpoints.down('sm'));
  const commitTeamSettings = useCommitTeamSettings();
  const { pathname } = useLocation();
  const isTeamScreen = pathname.includes('/team');
  const isSwitchTeamsScreen = pathname.includes('/switch-teams');
  const { userIsOrgAdmin, setMyOrgRole } = useRole();
  const ctx = useContext(TeamContext);
  const { teamDelete, personalTeam, teamProjects, cardStrings } =
    ctx?.state ?? {};
  const [offlineOnly] = useGlobal('offlineOnly');
  const [isOffline] = useGlobal('offline');

  const orgId = useMemo(
    () => localStorage.getItem(localUserKey(LocalKey.team)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user]
  );

  const isPersonal = useMemo(() => {
    return personalTeam === orgId;
  }, [personalTeam, orgId]);

  const orgRec = useMemo(() => {
    if (!orgId) return undefined;
    return organizations.find((o) => o.id === orgId);
  }, [orgId, organizations]);

  const isAdmin = useMemo(
    () => userIsOrgAdmin(orgId ?? ''),
    [orgId, userIsOrgAdmin]
  );

  const hasMoreThanOneProject = useMemo(() => {
    if (!orgId || !teamProjects) return false;
    return (teamProjects(orgId)?.length ?? 0) > 1;
  }, [orgId, teamProjects]);

  const canModify = useMemo(() => {
    return (!isOffline && isAdmin) || offlineOnly;
  }, [isAdmin, isOffline, offlineOnly]);

  const showSort = hasMoreThanOneProject && canModify;

  const handleSettingsMenuOpen = (e: React.MouseEvent<HTMLButtonElement>) => {
    setSettingsMenuEl(e.currentTarget);
  };

  const handleSettingsMenuClose = () => {
    setSettingsMenuEl(null);
  };

  const handleSettings = () => {
    setEditOpen(true);
    handleSettingsMenuClose();
  };

  const handleSort = () => {
    setSortVisible(true);
    handleSettingsMenuClose();
  };

  const handleWorkflow = () => {
    setWorkflowVisible(true);
    handleSettingsMenuClose();
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
          mx: 1,
        }}
      >
        {isSwitchTeamsScreen
          ? API_CONFIG.productName
          : cleanOrgName(orgRec) || API_CONFIG.productName}
      </Typography>
      {isTeamScreen && (
        <>
          {isAdmin && (
            <>
              <IconButton
                onClick={handleSettingsMenuOpen}
                aria-label="Settings Menu"
              >
                <SettingsIcon />
              </IconButton>
              <Menu
                anchorEl={settingsMenuEl}
                open={Boolean(settingsMenuEl)}
                onClose={handleSettingsMenuClose}
              >
                <MenuItem onClick={handleSettings}>
                  {cardStrings?.teamSettings || 'Team Settings'}
                </MenuItem>
                {canModify && (
                  <MenuItem onClick={handleWorkflow}>
                    {cardStrings?.editWorkflow?.replace('{0}', '') ||
                      'Edit Workflow'}
                  </MenuItem>
                )}
                {showSort && (
                  <MenuItem onClick={handleSort}>
                    {cardStrings?.sortProjects || 'Sort Projects'}
                  </MenuItem>
                )}
              </Menu>
            </>
          )}
          {orgRec && !isPersonal && (
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
      {workflowVisible && (
        <BigDialog
          title={
            isPersonal
              ? cardStrings?.editWorkflow?.replace(
                  '{0}',
                  `- ${cardStrings?.personalProjects || ''}`
                )
              : cardStrings?.editWorkflow?.replace(
                  '{0}',
                  `- ${orgRec?.attributes?.name || ''}`
                )
          }
          isOpen={workflowVisible}
          onOpen={setWorkflowVisible}
          bp={isMobileWidth ? BigDialogBp.mobile : BigDialogBp.md}
        >
          <StepEditor
            process={defaultWorkflow}
            org={isPersonal ? personalTeam || '' : orgId || ''}
          />
        </BigDialog>
      )}
      {orgId && sortVisible && (
        <BigDialog
          title={cardStrings?.sortProjects}
          isOpen={sortVisible}
          onOpen={setSortVisible}
          bp={isMobileWidth ? BigDialogBp.mobile : BigDialogBp.md}
        >
          <ProjectSort teamId={orgId} onClose={() => setSortVisible(false)} />
        </BigDialog>
      )}
    </Stack>
  );
};
