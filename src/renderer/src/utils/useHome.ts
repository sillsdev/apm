import { To, useNavigate } from 'react-router-dom';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { homeRoute, MOBILETEAM } from './routePaths';

interface HomeResult {
  goHome: () => void;
  leaveHome: () => void;
  checkHome: (to: To) => void;
  resetProject: () => void;
}

export const useHome = (): HomeResult => {
  const [, setProject] = useGlobal('project');
  const [, setProjType] = useGlobal('projType');
  const [, setPlan] = useGlobal('plan');
  const [, setOrgRole] = useGlobal('orgRole');
  const [, setHome] = useGlobal('home');
  const getGlobal = useGetGlobal();
  const navigate = useNavigate();

  const resetProject = (): void => {
    setProject('');
    setPlan('');
    setProjType('');
    setOrgRole(undefined);
  };
  const goHome = (): void => {
    resetProject();
    if (!getGlobal('home')) setHome(true);
    setTimeout(() => {
      navigate(homeRoute());
    }, 100);
  };
  const leaveHome = (): void => {
    if (getGlobal('home')) setHome(false);
  };
  const checkHome = (to: To): void => {
    const gohome =
      !to ||
      to === '/' ||
      to === MOBILETEAM ||
      /^\/projects\//.test(String(to));
    if (getGlobal('home') !== gohome) setHome(gohome);
  };

  return { goHome, leaveHome, checkHome, resetProject };
};
