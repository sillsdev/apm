import React from 'react';
import { Box, Stack, Typography, Button, IconButton } from '@mui/material';
import AppHead from '../components/App/AppHead';
import { TeamProvider, TeamContext, TeamIdType } from '../context/TeamContext';
import { useParams, useLocation } from 'react-router-dom';
import { ProjectCard } from '../components/Team/ProjectCard';
import TeamDialog from '../components/Team/TeamDialog';
import { DialogMode, VProject } from '../model';
import { ProjectDialog } from '../components/Team/ProjectDialog';
import { useMyNavigate } from '../utils/useMyNavigate';
import { getTeamsRoute, isMobileWidth } from '../utils/routePaths';
import { LocalKey, useJsonParams } from '../utils';
import { projDefBook, projDefStory } from '../crud/useProjectDefaults';
import { useGlobal, useGetGlobal } from '../context/useGlobal';
import { remoteId } from '../crud';
import { UnsavedContext } from '../context/UnsavedContext';
import BigDialog from '../hoc/BigDialog';
import { StepEditor } from '../components/StepEditor';
import { useRole, defaultWorkflow } from '../crud';
import SortIcon from '@mui/icons-material/Sort';
import { ProjectSort } from '../components/Team/ProjectDialog/ProjectSort';

const ProjectsScreenInner: React.FC = () => {
  const navigate = useMyNavigate();
  const { teamId } = useParams();
  const ctx = React.useContext(TeamContext);
  const {
    teamProjects,
    personalProjects,
    personalTeam,
    cardStrings,
    teams,
    isAdmin,
  } = ctx.state;
  const t = cardStrings;
  const { pathname } = useLocation();
  const [plan] = useGlobal('plan');
  const [memory] = useGlobal('memory');
  const [home, setHome] = useGlobal('home');
  const unsavedCtx = React.useContext(UnsavedContext);
  const { startClear, startSave, waitForSave } = unsavedCtx.state;
  const getGlobal = useGetGlobal();
  const [offline] = useGlobal('offline');
  const [offlineOnly] = useGlobal('offlineOnly');
  const [busy] = useGlobal('remoteBusy');
  const { userIsOrgAdmin } = useRole();

  const isPersonal = teamId === personalTeam;
  const projects = React.useMemo(
    () => (isPersonal ? personalProjects : teamId ? teamProjects(teamId) : []),
    [isPersonal, personalProjects, teamId, teamProjects]
  );

  const thisTeam = React.useMemo(() => {
    if (isPersonal)
      return {
        id: personalTeam,
        type: 'organization',
        attributes: { name: t.personalProjects },
      } as any;
    return teams.find((o) => o.id === teamId);
  }, [isPersonal, teamId, teams, t.personalProjects, personalTeam]);

  // Settings dialog control
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  // New project dialog state
  const [addOpen, setAddOpen] = React.useState(false);
  const handleAddProject = () => setAddOpen(true);

  // Edit workflow dialog state
  const [showWorkflow, setShowWorkflow] = React.useState(false);
  const [sortVisible, setSortVisible] = React.useState(false);
  const handleWorkflowOpen = (isOpen: boolean) => {
    if (getGlobal('changed')) {
      startSave();
      waitForSave(() => setShowWorkflow(isOpen), 500);
    } else setShowWorkflow(isOpen);
  };
  const handleEditWorkflow = () => setShowWorkflow(true);

  // duplicate name check for add dialog
  const nameInUse = React.useCallback(
    (newName: string) => {
      const compare = (p: any) =>
        (p?.attributes?.name || '').toLowerCase() === newName.toLowerCase();
      if (newName.trim() === '') return false;
      return projects.some(compare);
    },
    [projects]
  );

  const { projectCreate, generalBook } = ctx.state;
  const { setParam } = useJsonParams();

  const handleProjectCommit = async (values: any) => {
    const {
      name,
      description,
      type,
      bcp47,
      languageName,
      font,
      fontSize,
      isPublic,
      spellCheck,
      rtl,
      tags,
      flat,
      organizedBy,
      book,
      story,
      sheetUser,
      sheetGroup,
      publishUser,
      publishGroup,
    } = values;
    let defaultParams = setParam(
      projDefBook,
      book || generalBook(thisTeam?.id),
      '{}'
    );
    defaultParams = setParam(projDefStory, story, defaultParams);
    const vproj: VProject = {
      attributes: {
        name,
        description,
        type,
        language: bcp47 || 'und',
        languageName,
        isPublic,
        spellCheck,
        defaultFont: font,
        defaultFontSize: fontSize,
        rtl,
        tags,
        flat,
        organizedBy: organizedBy || 'section',
        defaultParams,
        sheetUser,
        sheetGroup,
        publishUser,
        publishGroup,
      },
    } as VProject;
    const teamForCreate: TeamIdType = isPersonal
      ? ({ id: undefined } as any)
      : (thisTeam as TeamIdType);
    await projectCreate(vproj, teamForCreate);
    setAddOpen(false);
  };

  React.useEffect(() => {
    startClear();
    setHome(true);
    // we intentionally do not reset project/plan here; selection will set them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Navigate to plan page only after user explicitly leaves home (card click triggers leaveHome)
  React.useEffect(() => {
    if (!plan) return; // no selection yet
    if (home) return; // still in home state (e.g., menu action opened dialog)
    // We no longer require current pathname to be /projects because plan might be set just as navigation fires
    const remotePlanId =
      remoteId('plan', plan, (memory as any)?.keyMap) || plan;
    // Only navigate if not already on this plan route
    if (!pathname.startsWith(`/plan/${remotePlanId}/`)) {
      localStorage.setItem(LocalKey.plan, plan); // persist only when committing navigation
      navigate(`/plan/${remotePlanId}/0`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, pathname, home]);

  // Admin gating (matches TeamItem logic): only show when viewing a team (not personal)
  const canModifyWorkflow = React.useMemo(() => {
    if (!thisTeam || isPersonal) return false;
    return (
      ((!offline && isAdmin(thisTeam)) || offlineOnly) &&
      userIsOrgAdmin(thisTeam.id)
    );
  }, [thisTeam, isPersonal, offline, offlineOnly, isAdmin, userIsOrgAdmin]);

  const canSortPersonal = !offline || offlineOnly;

  const showSortButton =
    projects.length > 1 && (isPersonal ? canSortPersonal : canModifyWorkflow);

  return (
    <Box sx={{ width: '100%' }}>
      <AppHead />
      <Box
        id="ProjectsScreen"
        sx={{
          paddingTop: '80px',
          pb: 4,
          px: 2,
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minHeight: '100vh',
          maxWidth: '500px',
        }}
      >
        {showSortButton && (
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'flex-end',
              mx: -1,
              pr: 1,
              width: '100%',
            }}
          >
            <IconButton
              id="ProjectActSort"
              aria-label={t.sortProjects || 'Sort projects'}
              title={t.sortProjects || 'Sort projects'}
              onClick={() => setSortVisible(true)}
              size="small"
            >
              <SortIcon />
            </IconButton>
          </Box>
        )}
        <Stack direction="column" spacing={1} width={'100%'}>
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
          {projects.length === 0 && (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              {/* Fallback only; string key not defined yet */}
              {'No projects yet.'}
            </Typography>
          )}
        </Stack>
        {/* spacer to ensure content isn't hidden behind floating actions */}
        <Box sx={{ height: 120 }} />
      </Box>
      <Box
        sx={{
          position: 'fixed',
          bottom: 32,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <Stack
          direction="row"
          spacing={2}
          sx={{ pointerEvents: 'auto', alignItems: 'center' }}
        >
          <Button
            id="ProjectActAdd"
            data-testid="add-project-button"
            variant="outlined"
            onClick={handleAddProject}
            sx={(theme) => ({
              minWidth: 160,
              bgcolor: theme.palette.common.white,
            })}
          >
            {t.newProject || 'Add New Project...'}
          </Button>
          {canModifyWorkflow && !isMobileWidth() && (
            <Button
              id="ProjectActEditWorkflow"
              variant="outlined"
              onClick={handleEditWorkflow}
              disabled={busy}
              sx={(theme) => ({
                minWidth: 160,
                bgcolor: theme.palette.common.white,
              })}
            >
              {t.editWorkflow.replace('{0}', '')}
            </Button>
          )}
          <Button
            id="ProjectActSwitch"
            variant="outlined"
            onClick={() => {
              localStorage.removeItem(LocalKey.plan);
              navigate(getTeamsRoute());
            }}
            sx={(theme) => ({
              minWidth: 120,
              bgcolor: theme.palette.common.white,
            })}
          >
            {t.switchTeams || 'Switch Teams'}
          </Button>
        </Stack>
      </Box>
      <BigDialog
        title={t.editWorkflow.replace(
          '{0}',
          `- ${thisTeam?.attributes?.name || ''}`
        )}
        isOpen={showWorkflow}
        onOpen={handleWorkflowOpen}
      >
        {/* Use defaultWorkflow, same as TeamItem */}
        <StepEditor process={defaultWorkflow} org={thisTeam?.id} />
      </BigDialog>
      <BigDialog
        title={t.sortProjects}
        isOpen={sortVisible}
        onOpen={() => setSortVisible(false)}
      >
        <ProjectSort
          teamId={isPersonal ? undefined : thisTeam?.id}
          onClose={() => setSortVisible(false)}
        />
      </BigDialog>
      {settingsOpen && thisTeam && (
        <TeamDialog
          mode={DialogMode.edit}
          isOpen={settingsOpen}
          onOpen={(open) => setSettingsOpen(open)}
          values={{ team: thisTeam } as any}
          onCommit={() => setSettingsOpen(false)}
        />
      )}
      {addOpen && (
        <ProjectDialog
          mode={DialogMode.add}
          isOpen={addOpen}
          onOpen={setAddOpen}
          values={undefined as any}
          onCommit={handleProjectCommit}
          nameInUse={nameInUse}
          team={isPersonal ? undefined : thisTeam?.id}
        />
      )}
    </Box>
  );
};

export const ProjectsScreen: React.FC = () => (
  <TeamProvider>
    <ProjectsScreenInner />
  </TeamProvider>
);

export default ProjectsScreen;
