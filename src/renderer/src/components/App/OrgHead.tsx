import { useContext, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { shallowEqual, useSelector } from 'react-redux';
import { Box, IconButton, Menu, MenuItem, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import UsersIcon from '@mui/icons-material/People';
import { RecordIdentity } from '@orbit/records';
import { API_CONFIG } from '../../../api-variable';
import { OrganizationD } from '@model/organization';
import { DialogMode, ICardsStrings, ProjectD } from '../../model';
import { TeamContext } from '../../context/TeamContext';
import { UnsavedContext } from '../../context/UnsavedContext';
import { useGetGlobal, useGlobal } from '../../context/useGlobal';
import { useMobile } from '../../utils';
import { LocalKey, localUserKey } from '../../utils/localUserKey';
import { defaultWorkflow, useTeamWorkflowProcess } from '../../crud';
import { useCommitTeamSettings } from '../../crud/useCommitTeamSettings';
import { useRole } from '../../crud/useRole';
import BigDialog from '../../hoc/BigDialog';
import { BigDialogBp } from '../../hoc/BigDialogBp';
import { useOrbitData } from '../../hoc/useOrbitData';
import { cardsSelector } from '../../selector';
import Confirm from '../AlertDialog';
import GroupTabs from '../GroupTabs';
import { StepEditor } from '../StepEditor';
import { ProjectSort } from '../Team/ProjectDialog/ProjectSort';
import TeamDialog, { ITeamDialog } from '../Team/TeamDialog';

// A personal team's name is stored wrapped in '>' … '<' (see useOfflineList,
// useVoicePermission); the header shows the bare name.
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

export const OrgHead = () => {
  const { pathname } = useLocation();
  const isTeamScreen = pathname.includes('/team');
  const isSwitchTeamsScreen = pathname.includes('/switch-teams');
  const { isMobile, isMobileView } = useMobile();

  const [user] = useGlobal('user');
  const [project] = useGlobal('project');
  const [offlineOnly] = useGlobal('offlineOnly');
  const [isOffline] = useGlobal('offline');
  const [connected] = useGlobal('connected');
  const getGlobal = useGetGlobal();

  const organizations = useOrbitData<OrganizationD[]>('organization');
  const projects = useOrbitData<ProjectD[]>('project');
  const ctx = useContext(TeamContext);
  const { teamDelete, personalTeam, teamProjects } = ctx?.state ?? {};
  const { startSave, waitForSave } = useContext(UnsavedContext).state;
  const { userIsOrgAdmin, setMyOrgRole } = useRole();
  const commitTeamSettings = useCommitTeamSettings();
  const cardStrings: ICardsStrings = useSelector(cardsSelector, shallowEqual);

  const [settingsMenuEl, setSettingsMenuEl] = useState<null | HTMLElement>(
    null
  );
  const [editOpen, setEditOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<RecordIdentity>();
  const [openMember, setOpenMember] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const [workflowVisible, setWorkflowVisible] = useState(false);

  const orgId = useMemo(
    () => localStorage.getItem(localUserKey(LocalKey.team)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user]
  );

  const orgRec = useMemo(() => {
    if (!orgId) return undefined;
    return organizations.find((o) => o.id === orgId);
  }, [orgId, organizations]);

  const projectRec = useMemo(() => {
    if (!project) return undefined;
    return projects.find((p) => p.id === project);
  }, [project, projects]);

  const isPersonal = useMemo(() => {
    return personalTeam === orgId;
  }, [personalTeam, orgId]);

  const headerWorkflowProcess = useTeamWorkflowProcess(orgId ?? undefined);
  const stepEditorProcess = headerWorkflowProcess ?? defaultWorkflow;

  const isAdmin = useMemo(
    () => userIsOrgAdmin(orgId ?? ''),
    [orgId, userIsOrgAdmin]
  );

  const canModify = useMemo(() => {
    return (!isOffline && connected && isAdmin) || offlineOnly;
  }, [isAdmin, isOffline, offlineOnly, connected]);

  const hasMoreThanOneProject = useMemo(() => {
    if (!orgId || !teamProjects) return false;
    return (teamProjects(orgId)?.length ?? 0) > 1;
  }, [orgId, teamProjects]);

  const showSort = hasMoreThanOneProject && canModify;

  const showTeamActions = isTeamScreen && isMobile;

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

  const handleWorkflow = () => {
    setWorkflowVisible(true);
    handleSettingsMenuClose();
  };

  const handleWorkflowClose = (isOpen: boolean) => {
    if (getGlobal('changed')) {
      startSave();
      waitForSave(() => setWorkflowVisible(isOpen), 500);
    } else setWorkflowVisible(isOpen);
  };

  const handleSort = () => {
    setSortVisible(true);
    handleSettingsMenuClose();
  };

  const handleMembers = (team: OrganizationD) => () => {
    setMyOrgRole(team.id);
    setOpenMember(true);
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

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: (theme) => theme.layout.gap,
        flex: '1 1 auto',
        minWidth: 0,
      }}
    >
      <Typography
        noWrap
        sx={{
          minWidth: 0,
          fontWeight: 'bold',
          position: 'relative',
          top: '1px',
        }}
      >
        {isSwitchTeamsScreen
          ? API_CONFIG.productName
          : isTeamScreen
            ? (isMobile && cleanOrgName(orgRec)) || API_CONFIG.productName
            : projectRec?.attributes.name || API_CONFIG.productName}
      </Typography>
      {showTeamActions && canModify && (
        <IconButton
          onClick={handleSettingsMenuOpen}
          aria-label="Settings Menu"
          sx={{ flexShrink: 0 }}
        >
          <SettingsIcon />
        </IconButton>
      )}
      {showTeamActions && orgRec && !isPersonal && (
        <IconButton onClick={handleMembers(orgRec)} sx={{ flexShrink: 0 }}>
          <UsersIcon />
        </IconButton>
      )}
      {showTeamActions && canModify && (
        <Menu
          anchorEl={settingsMenuEl}
          open={Boolean(settingsMenuEl)}
          onClose={handleSettingsMenuClose}
        >
          <MenuItem onClick={handleSettings}>
            {cardStrings?.teamSettings || 'Team Settings'}
          </MenuItem>
          {!isMobileView && (
            <MenuItem id="orgHeadEditWorkflow" onClick={handleWorkflow}>
              {cardStrings?.editWorkflow?.replace('{0}', '') || 'Edit Workflow'}
            </MenuItem>
          )}
          {showSort && (
            <MenuItem onClick={handleSort}>
              {cardStrings?.sortProjects || 'Sort Projects'}
            </MenuItem>
          )}
        </Menu>
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
        title={cardStrings?.members?.replace(
          '{0}',
          orgRec?.attributes?.name || ''
        )}
        isOpen={openMember}
        onOpen={setOpenMember}
        bp={isMobile ? BigDialogBp.mobile : BigDialogBp.md}
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
          onOpen={handleWorkflowClose}
          bp={isMobile ? BigDialogBp.mobile : BigDialogBp.md}
        >
          <StepEditor
            process={stepEditorProcess}
            org={isPersonal ? personalTeam || '' : orgId || ''}
          />
        </BigDialog>
      )}
      {orgId && sortVisible && (
        <BigDialog
          title={cardStrings?.sortProjects}
          isOpen={sortVisible}
          onOpen={setSortVisible}
          bp={isMobile ? BigDialogBp.mobile : BigDialogBp.md}
        >
          <ProjectSort teamId={orgId} onClose={() => setSortVisible(false)} />
        </BigDialog>
      )}
    </Box>
  );
};
