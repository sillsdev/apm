import { useState, useEffect, useContext, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Grid } from '@mui/material';
import { RecordKeyMap } from '@orbit/records';
import { PlanD } from '../model';
import { useGlobal } from '../context/useGlobal';
import { TeamProvider } from '../context/TeamContext';
import { UnsavedContext } from '../context/UnsavedContext';
import { findRecord, related, remoteId } from '../crud';
import { LocalKey, localUserKey, useHome, useMobile } from '../utils';
import AppHead from '../components/App/AppHead';
import AppLayout from '../components/App/AppLayout';
import StickyRedirect from '../components/StickyRedirect';
import { TeamProjects } from '../components/Team';
import TeamActions from '../components/Team/TeamActions';
import ProjectsScreen from './ProjectsScreen';

export default function TeamScreen() {
  const { pathname } = useLocation();
  const [memory] = useGlobal('memory');
  const [isOffline] = useGlobal('offline');
  const [project, setProject] = useGlobal('project');
  const [projType] = useGlobal('projType');
  const [plan] = useGlobal('plan');
  const [home, setHome] = useGlobal('home');
  const { startClear } = useContext(UnsavedContext).state;
  const { resetProject } = useHome();
  const { isMobile } = useMobile();
  const [view, setView] = useState('');
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

  if (isMobile) {
    return <ProjectsScreen />;
  }

  return (
    <TeamProvider>
      <AppLayout
        header={
          <AppHead sx={{ borderBottom: '1px solid', borderColor: 'divider' }} />
        }
        content={
          <Grid container id="TeamScreen">
            <Grid size={{ xs: 6, md: 3, lg: 2 }}>
              <TeamActions />
            </Grid>
            <Grid size={{ xs: 12, md: 9, lg: 10 }}>
              <TeamProjects />
            </Grid>
          </Grid>
        }
      />
    </TeamProvider>
  );
}
