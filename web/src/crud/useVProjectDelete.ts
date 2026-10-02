import { VProject } from '../model';
import { related } from '.';
import { useProjectDelete } from './useProjectDelete';

export const useVProjectDelete = () => {
  const projectDelete = useProjectDelete();

  return async (vProject: VProject) => {
    const id = related(vProject, 'project');
    // TT-6952: await, so TeamContext.projectDelete's resetProject() cannot run
    // (and redirect) while the removals are still in flight.
    await projectDelete(id);
  };
};
