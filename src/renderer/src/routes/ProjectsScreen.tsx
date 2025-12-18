import React from 'react';
import {
  Box,
  Stack,
  Typography,
  Button,
  Grid,
  useTheme,
  useMediaQuery,
  BoxProps,
  styled,
} from '@mui/material';
import AppHead from '../components/App/AppHead';
import { TeamProvider, TeamContext, TeamIdType } from '../context/TeamContext';
import { useLocation } from 'react-router-dom';
import { ProjectCard } from '../components/Team/ProjectCard';
import { DialogMode, VProject } from '../model';
import { ProjectDialog } from '../components/Team/ProjectDialog';
import { useMyNavigate } from '../utils/useMyNavigate';
import { LocalKey, localUserKey, useJsonParams } from '../utils';
import { projDefBook, projDefStory } from '../crud/useProjectDefaults';
import { useGlobal, useGetGlobal } from '../context/useGlobal';
import { remoteId } from '../crud';
import { UnsavedContext } from '../context/UnsavedContext';
import BigDialog from '../hoc/BigDialog';
import { StepEditor } from '../components/StepEditor';
import { defaultWorkflow } from '../crud';

interface ProjectBoxProps extends BoxProps {
  isMobile?: boolean;
}
const ProjectsBox = styled(Box)<ProjectBoxProps>(({ theme, isMobile }) => ({
  ...(isMobile && {
    '& #projectMenu': {
      color: theme.palette.common.white,
    },
  }),
}));

const ProjectsScreenInner: React.FC = () => {
  const navigate = useMyNavigate();
  const teamId = localStorage.getItem(localUserKey(LocalKey.team));
  const ctx = React.useContext(TeamContext);
  const { teamProjects, personalProjects, personalTeam, cardStrings, teams } =
    ctx.state;
  const t = cardStrings;
  const { pathname } = useLocation();
  const [plan] = useGlobal('plan');
  const [memory] = useGlobal('memory');
  const [home, setHome] = useGlobal('home');
  const unsavedCtx = React.useContext(UnsavedContext);
  const { startClear, startSave, waitForSave } = unsavedCtx.state;
  const getGlobal = useGetGlobal();
  const theme = useTheme();
  const isMobileWidth = useMediaQuery(theme.breakpoints.down('sm'));

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

  // New project dialog state
  const [addOpen, setAddOpen] = React.useState(false);
  const handleAddProject = () => setAddOpen(true);

  // Edit workflow dialog state
  const [showWorkflow, setShowWorkflow] = React.useState(false);
  const handleWorkflowOpen = (isOpen: boolean) => {
    if (getGlobal('changed')) {
      startSave();
      waitForSave(() => setShowWorkflow(isOpen), 500);
    } else setShowWorkflow(isOpen);
  };

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

  const handleSwitchTeams = () => {
    localStorage.removeItem(LocalKey.plan);
    navigate('/switch-teams');
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

  return (
    <Box sx={{ width: '100%' }}>
      <AppHead />
      <ProjectsBox
        id="ProjectsScreen"
        isMobile={isMobileWidth}
        sx={{
          paddingTop: '80px',
          px: 2,
          pb: 8,
          mx: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          minHeight: '100vh',
        }}
      >
        <Grid container spacing={1}>
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
          {projects.length === 0 && (
            <Typography variant="body2" sx={{ opacity: 0.7 }}>
              {t.noProjects || 'No projects yet.'}
            </Typography>
          )}
        </Grid>
        {/* spacer to ensure content isn't hidden behind floating actions */}
        <Box sx={{ height: 120 }} />
      </ProjectsBox>
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
            {t.addNewProject || 'Add New Project...'}
          </Button>
          <Button
            id="ProjectActSwitch"
            variant="outlined"
            onClick={handleSwitchTeams}
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
