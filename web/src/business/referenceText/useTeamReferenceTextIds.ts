import { useContext, useMemo } from 'react';
import { TeamContext } from '../../context/TeamContext';
import { useOrbitData } from '../../hoc/useOrbitData';
import related from '../../crud/related';
import { projDefReferenceTexts } from '../../crud/useProjectDefaults';
import { useJsonParams } from '../../utils/useJsonParams';
import type { ProjectD } from '../../model';
import { usedReferenceTextIds } from './referenceText';

/** Ids of Reference Texts already chosen on the team's projects (personal projects without a team). */
export const useTeamReferenceTextIds = (team?: string) => {
  const { teamProjects, personalProjects } = useContext(TeamContext).state;
  const projects = useOrbitData<ProjectD[]>('project');
  const { getParam } = useJsonParams();

  return useMemo(
    () => {
      const ids = new Set(
        (team ? teamProjects(team) : personalProjects).map((p) =>
          related(p, 'project')
        )
      );
      return usedReferenceTextIds(
        projects
          .filter((p) => ids.has(p.id))
          .map((p) =>
            getParam(projDefReferenceTexts, p.attributes?.defaultParams)
          )
      );
    },
    // teamProjects and getParam are recreated each render; projects and
    // personalProjects carry the changes they depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projects, personalProjects, team]
  );
};
