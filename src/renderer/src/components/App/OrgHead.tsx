import { useContext, useMemo, useState } from 'react';
import { LocalKey, localUserKey } from '../../utils/localUserKey';
import { useMobile } from '../../utils';
import { useGlobal } from '../../context/useGlobal';
import { IconButton, Menu, MenuItem, Stack, Typography } from '@mui/material';
import SettingsIcon from '@mui/icons-material/Settings';
import UsersIcon from '@mui/icons-material/People';
import { API_CONFIG } from '../../../api-variable';
import { OrganizationD } from '@model/organization';
import TeamDialog, { ITeamDialog } from '../Team/TeamDialog';
import { DialogMode, ICardsStrings, ProjectD } from '../../model';
import { shallowEqual, useSelector } from 'react-redux';
import { cardsSelector } from '../../selector';
import { useCommitTeamSettings } from '../../crud/useCommitTeamSettings';
import { RecordIdentity } from '@orbit/records';
import Confirm from '../AlertDialog';
import { TeamContext } from '../../context/TeamContext';
import { useLocation } from 'react-router-dom';
import BigDialog from '../../hoc/BigDialog';
import { BigDialogBp } from '../../hoc/BigDialogBp';
import GroupTabs from '../GroupTabs';
import { StepEditor } from '../StepEditor';
import { defaultWorkflow, useTeamWorkflowProcess } from '../../crud';
import { useRole } from '../../crud/useRole';
import { useOrbitData } from '../../hoc/useOrbitData';
import { ProjectSort } from '../Team/ProjectDialog/ProjectSort';

export const OrgHead = () => {
  const [user] = useGlobal('user');
  const organizations = useOrbitData<OrganizationD[]>('organization');
  const projects = useOrbitData<ProjectD[]>('project');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<RecordIdentity>();
  const [openMember, setOpenMember] = useState(false);
  const [settingsMenuEl, setSettingsMenuEl] = useState<null | HTMLElement>(
    null
  );
  const [sortVisible, setSortVisible] = useState(false);
  const [workflowVisible, setWorkflowVisible] = useState(false);
  const { isMobile, isMobileView } = useMobile();
  const commitTeamSettings = useCommitTeamSettings();
  const { pathname } = useLocation();
  const isTeamScreen = pathname.includes('/team');
  const isSwitchTeamsScreen = pathname.includes('/switch-teams');
  const { userIsOrgAdmin, setMyOrgRole } = useRole();
  const ctx = useContext(TeamContext);
  const { teamDelete, personalTeam, teamProjects } = ctx?.state ?? {};
  const cardStrings: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const [project] = useGlobal('project');
  const [offlineOnly] = useGlobal('offlineOnly');
  const [isOffline] = useGlobal('offline');
  const [connected] = useGlobal('connected');

  const orgId = useMemo(
    () => localStorage.getItem(localUserKey(LocalKey.team)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user]
  );

  const projectRec = useMemo(() => {
    if (!project) return undefined;
    return projects.find((p) => p.id === project);
  }, [project, projects]);

  const isPersonal = useMemo(() => {
    return personalTeam === orgId;
  }, [personalTeam, orgId]);

  const orgRec = useMemo(() => {
    if (!orgId) return undefined;
    return organizations.find((o) => o.id === orgId);
  }, [orgId, organizations]);

  const headerWorkflowProcess = useTeamWorkflowProcess(orgId ?? undefined);
  const stepEditorProcess = headerWorkflowProcess ?? defaultWorkflow;

  const isAdmin = useMemo(
    () => userIsOrgAdmin(orgId ?? ''),
    [orgId, userIsOrgAdmin]
  );

  const hasMoreThanOneProject = useMemo(() => {
    if (!orgId || !teamProjects) return false;
    return (teamProjects(orgId)?.length ?? 0) > 1;
  }, [orgId, teamProjects]);

  const canModify = useMemo(() => {
    return (!isOffline && connected && isAdmin) || offlineOnly;
  }, [isAdmin, isOffline, offlineOnly, connected]);

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
    <Stack direction="row" alignItems="center" sx={{ minWidth: 0 }}>
      <Typography
        noWrap
        sx={{
          minWidth: 0,
          mx: 1,
          fontWeight: 'bold',
          position: 'relative',
          top: '1px',
        }}
      >
        {isSwitchTeamsScreen
          ? API_CONFIG.productName
          : isTeamScreen
            ? cleanOrgName(orgRec) || API_CONFIG.productName
            : projectRec?.attributes.name || API_CONFIG.productName}
      </Typography>
      {isTeamScreen && (
        <>
          {canModify && (
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
                {!isMobileView && (
                  <MenuItem id="orgHeadEditWorkflow" onClick={handleWorkflow}>
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
          onOpen={setWorkflowVisible}
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
    </Stack>
  );
};
