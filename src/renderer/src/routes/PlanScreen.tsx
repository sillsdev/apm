import React from 'react';
import { useGlobal } from '../context/useGlobal';
import { useParams, useLocation } from 'react-router-dom';
import AppLayout from '../components/App/AppLayout';
import { PlanProvider } from '../context/PlanContext';
import PlanTabs from '../components/PlanTabs';
import { useUrlContext, useProjectType } from '../crud';
import { UnsavedContext } from '../context/UnsavedContext';
import StickyRedirect from '../components/StickyRedirect';
import { FillColumn } from '../control';

export const PlanScreen = () => {
  const { pathname } = useLocation();
  const { prjId } = useParams();
  const setUrlContext = useUrlContext();
  const uctx = React.useContext(UnsavedContext);
  const { checkSavedFn } = uctx.state;
  const [projType] = useGlobal('projType'); //verified this is not used in a function 2/18/25
  const { setProjectType } = useProjectType();
  const [project] = useGlobal('project'); //will be constant here
  const [organization] = useGlobal('organization');
  const [user] = useGlobal('user');
  const [view, setView] = React.useState('');

  React.useEffect(() => {
    const projectId = setUrlContext(prjId ?? '');
    if (projType === '') setProjectType(projectId);
    if (user && !projType) {
      // If user is set but we don't have this project, go to the team screen
      setView('/team');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    setUrlContext(prjId ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prjId]);

  React.useEffect(() => {
    if (project === '' && organization !== '' && view !== '/team')
      setView('/team');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project, organization]);

  if (view !== '' && view !== pathname) return <StickyRedirect to={view} />;

  return (
    <AppLayout appHeadProps={{ switchTo: false, drawBottomBorder: false }}>
      <PlanProvider>
        <FillColumn id="PlanScreen" sx={{ overflow: 'hidden' }}>
          <PlanTabs checkSaved={checkSavedFn} />
        </FillColumn>
      </PlanProvider>
    </AppLayout>
  );
};

export default PlanScreen;
