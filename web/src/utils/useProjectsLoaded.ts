import { useGetGlobal, useGlobal } from '../context/useGlobal';

export const useProjectsLoaded = (): typeof AddProjectLoaded => {
  const getGlobal = useGetGlobal();
  const [, setProjectsLoaded] = useGlobal('projectsLoaded');

  function AddProjectLoaded(project: string): void {
    if (getGlobal('projectsLoaded').includes(project)) return;
    const pl = [...getGlobal('projectsLoaded')];
    pl.push(project);
    setProjectsLoaded(pl);
  }
  return AddProjectLoaded;
};
