import { useState, useEffect, useContext, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Box, Divider } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { RecordKeyMap } from '@orbit/records';
import AppLayout from '../components/App/AppLayout';
import StickyRedirect from '../components/StickyRedirect';
import { TeamProjects } from '../components/Team';
import TeamActions from '../components/Team/TeamActions';
import { TeamProvider } from '../context/TeamContext';
import { UnsavedContext } from '../context/UnsavedContext';
import { useGlobal } from '../context/useGlobal';
import { findRecord, related, remoteId } from '../crud';
import { PlanD } from '../model';
import { LocalKey, localUserKey, useHome, useMobile } from '../utils';
import { flexibleSx } from '../control';
import ProjectsScreen from './ProjectsScreen';

export const TeamScreen = () => {
  const { pathname } = useLocation();
  const [isOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [project, setProject] = useGlobal('project'); //verified this is not used in a function 2/18/25
  const [projType] = useGlobal('projType'); //verified this is not used in a function 2/18/25
  const [memory] = useGlobal('memory');
  const [plan] = useGlobal('plan'); //verified this is not used in a function 2/18/25
  const [home, setHome] = useGlobal('home'); //verified this is not used in a function 2/18/25
  const [view, setView] = useState('');
  const { startClear } = useContext(UnsavedContext).state;
  const { resetProject } = useHome();
  const { isMobile } = useMobile();
  const theme = useTheme();
  const loaded = useRef(false);

  useEffect(() => {
    startClear();
    setHome(true);
    loaded.current = true;
    return () => {
      loaded.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loaded.current) {
      let selectedPlan = localStorage.getItem('selected-plan');
      let selectedProject = project;
      if (selectedPlan) {
        if (!selectedProject) {
          const planRec = findRecord(memory, 'plan', selectedPlan) as PlanD;
          selectedProject = related(planRec, 'project') as string;
          setProject(selectedProject);
        }
      } else {
        selectedPlan = plan;
      }
      if (selectedProject !== '' && selectedPlan && !home) {
        const remProjId = remoteId(
          'plan',
          selectedPlan,
          memory?.keyMap as RecordKeyMap
        );
        const loc = `/plan/${remProjId || selectedPlan}/0`;
        if (loc !== localStorage.getItem(localUserKey(LocalKey.url))) {
          setView(loc);
        } else {
          localStorage.setItem(localUserKey(LocalKey.url), '/team');
          resetProject();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, projType, isOffline, plan, home]);

  if (view !== '' && view !== pathname) {
    return <StickyRedirect to={view} />;
  }

  return !isMobile ? (
    <TeamProvider>
      <AppLayout>
        <Box
          id="TeamScreen"
          sx={{
            display: 'flex',
            height: '100%',
            gap: theme.layout.gap,
          }}
        >
          <Box
            sx={{
              ...flexibleSx,
              maxWidth: 250,
              py: theme.layout.gap,
              pl: theme.layout.gap,
            }}
          >
            <TeamActions />
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box
            sx={{
              ...flexibleSx,
              overflow: 'auto',
              py: theme.layout.gap,
              pr: theme.layout.gap,
            }}
          >
            <TeamProjects />
          </Box>
        </Box>
      </AppLayout>
    </TeamProvider>
  ) : (
    <ProjectsScreen />
  );
};

export default TeamScreen;
