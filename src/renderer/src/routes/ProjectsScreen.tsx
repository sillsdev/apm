import { useState, useContext, useCallback, useEffect, useMemo } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { Box, Typography, Grid, useTheme } from '@mui/material';
import { DialogMode, ICardsStrings, VProject } from '../model';
import { cardsSelector } from '../selector';
import AppLayout from '../components/App/AppLayout';
import ContentLayout from '../components/App/ContentLayout';
import { StepEditor } from '../components/StepEditor';
import { CardSizeProvider } from '../components/Team/CardSize';
import { ProjectCard } from '../components/Team/ProjectCard';
import { ProjectDialog } from '../components/Team/ProjectDialog';
import { TeamProvider, TeamContext, TeamIdType } from '../context/TeamContext';
import { UnsavedContext } from '../context/UnsavedContext';
import { useGlobal, useGetGlobal } from '../context/useGlobal';
import { Button, rowSx, spreadSx } from '../control';
import { remoteId, defaultWorkflow, useTeamWorkflowProcess } from '../crud';
import { projDefBook, projDefStory } from '../crud/useProjectDefaults';
import BigDialog from '../hoc/BigDialog';
import { LocalKey, localUserKey, useJsonParams } from '../utils';
import { useIsPapLike } from '../utils/useIsPapLike';
import { useMyNavigate } from '../utils/useMyNavigate';

export const ProjectsScreenInner = () => {
  const theme = useTheme();
  const navigate = useMyNavigate();
  const teamId = localStorage.getItem(localUserKey(LocalKey.team));
  const ctx = useContext(TeamContext);
  const { teamProjects, personalProjects, personalTeam, teams, isAdmin } =
    ctx.state;
  const t: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const { pathname } = useLocation();
  const [plan] = useGlobal('plan');
  const [memory] = useGlobal('memory');
  const [home, setHome] = useGlobal('home');
  const [connected] = useGlobal('connected');
  const [isOffline] = useGlobal('offline');
  const [offlineOnly] = useGlobal('offlineOnly');
  const unsavedCtx = useContext(UnsavedContext);
  const { startClear, startSave, waitForSave } = unsavedCtx.state;
  const getGlobal = useGetGlobal();

  const handleSwitchTeams = useCallback(() => {
    localStorage.removeItem(LocalKey.plan);
    navigate('/switch-teams');
  }, [navigate]);

  // Missing teamId: always open picker; SwitchTeamsInner redirects true PAP-like users back to /team
  useEffect(() => {
    const currentId = localStorage.getItem(localUserKey(LocalKey.team));
    if (currentId) return;
    if (!personalTeam) return;
    handleSwitchTeams();
  }, [personalTeam, handleSwitchTeams]);

  useEffect(() => {
    startClear();
    setHome(true);
    // we intentionally do not reset project/plan here; selection will set them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPersonal = teamId === personalTeam;
  const isPapLike = useIsPapLike() && isPersonal;
  const projects = useMemo(
    () => (isPersonal ? personalProjects : teamId ? teamProjects(teamId) : []),
    [isPersonal, personalProjects, teamId, teamProjects]
  );

  const thisTeam = useMemo(() => {
    if (isPersonal)
      return {
        id: personalTeam,
        type: 'organization',
        attributes: { name: t.personalProjects },
      } as any;
    return teams.find((o) => o.id === teamId);
  }, [isPersonal, teamId, teams, t.personalProjects, personalTeam]);

  const teamWorkflowProcess = useTeamWorkflowProcess(thisTeam?.id);
  const workflowEditProcess = teamWorkflowProcess ?? defaultWorkflow;

  // New project dialog state
  const [addOpen, setAddOpen] = useState(false);
  const handleAddProject = () => setAddOpen(true);

  // Edit workflow dialog state
  const [showWorkflow, setShowWorkflow] = useState(false);
  const handleWorkflowOpen = (isOpen: boolean) => {
    if (getGlobal('changed')) {
      startSave();
      waitForSave(() => setShowWorkflow(isOpen), 500);
    } else setShowWorkflow(isOpen);
  };

  // duplicate name check for add dialog
  const nameInUse = useCallback(
    (newName: string) => {
      const trimmedName = newName.trim();
      if (trimmedName === '') return false;
      const compare = (p: any) =>
        (p?.attributes?.name || '').trim().toLowerCase() ===
        trimmedName.toLowerCase();
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

  // Navigate to plan page only after user explicitly leaves home (card click triggers leaveHome)
  useEffect(() => {
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

  const showAddButton = useMemo(() => {
    const canAdd =
      ((!isOffline && connected) || offlineOnly) &&
      thisTeam &&
      isAdmin(thisTeam);
    return Boolean(canAdd);
  }, [thisTeam, isAdmin, connected, isOffline, offlineOnly]);

  // Early return when teamId is missing to prevent errors in derived values
  if (!teamId) {
    return null; // or a loading state
  }

  return (
    <>
      <AppLayout appHeadProps={{ drawBottomBorder: false }}>
        <ContentLayout
          header={
            <Box sx={spreadSx}>
              <Box sx={rowSx}>
                {!isPapLike && (
                  <Button id="ProjectActSwitch" onClick={handleSwitchTeams}>
                    {t.switchTeams || 'Switch Teams'}
                  </Button>
                )}
              </Box>
              <Box sx={rowSx}>
                {showAddButton && (
                  <Button
                    id="ProjectActAdd"
                    data-testid="add-project-button"
                    onClick={handleAddProject}
                  >
                    {t.addNewProject || 'Add New Project...'}
                  </Button>
                )}
              </Box>
            </Box>
          }
          drawBottomBorder
          contentSx={{ p: theme.layout.gap }}
        >
          <Box
            id="ProjectsScreen"
            sx={{
              flex: '1 0 auto',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              p: theme.layout.p,
            }}
          >
            <CardSizeProvider>
              <Grid container spacing={theme.layout.gap}>
                {projects.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </Grid>
            </CardSizeProvider>
            {projects.length === 0 && (
              <Box
                sx={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Typography
                  noWrap
                  sx={{
                    fontSize: 'large',
                    fontWeight: 'bold',
                    opacity: 0.7,
                    userSelect: 'none',
                  }}
                >
                  {t.noProjects || 'No projects yet.'}
                </Typography>
              </Box>
            )}
          </Box>
        </ContentLayout>
      </AppLayout>
      <BigDialog
        title={t.editWorkflow.replace(
          '{0}',
          `- ${thisTeam?.attributes?.name || ''}`
        )}
        isOpen={showWorkflow}
        onOpen={handleWorkflowOpen}
      >
        {/* Use defaultWorkflow, same as TeamItem */}
        <StepEditor process={workflowEditProcess} org={thisTeam?.id} />
      </BigDialog>
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
    </>
  );
};

export const ProjectsScreen = () => (
  <TeamProvider>
    <ProjectsScreenInner />
  </TeamProvider>
);

export default ProjectsScreen;
