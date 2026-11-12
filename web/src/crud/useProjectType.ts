import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { related } from '.';
import { ProjectD, ProjectType, VProject } from '../model';
import { ReplaceRelatedRecord } from '../model/baseModel';
import { logError, Severity } from '../utils';

export const useProjectType = () => {
  const [memory] = useGlobal('memory');
  const [, setProjType] = useGlobal('projType');
  const getGlobal = useGetGlobal();
  const [errorReporter] = useGlobal('errorReporter');

  const getProjType = (project: string | VProject) => {
    let proj: ProjectD;
    let pId: string;
    if (typeof project === 'string') {
      if (project === '') return '';
      pId = project;
    } else pId = related(project, 'project');
    if (!pId) return '';
    try {
      proj = memory?.cache.query((q) =>
        q.findRecord({ type: 'project', id: pId })
      ) as ProjectD;
    } catch {
      // During refresh the project might not be found
      logError(
        Severity.info,
        errorReporter,
        'project not found in useProjectType'
      );
      return 'Scripture';
    }

    const ptId = related(proj, 'projecttype');
    let pt: ProjectType;
    if (ptId) {
      pt = memory?.cache.query((q) =>
        q.findRecord({ type: 'projecttype', id: ptId })
      ) as ProjectType;
      return pt.attributes.name;
    } else if (proj?.attributes) {
      //default to scripture so they don't lose any book info they have
      logError(
        Severity.error,
        errorReporter,
        `missing project type=project${proj?.attributes?.name}${proj?.keys?.remoteId}`
      );
      let pts = memory?.cache.query((q) =>
        q.findRecords('projecttype')
      ) as ProjectType[];
      const online = Boolean(proj?.keys?.remoteId);
      pts = pts.filter(
        (p) =>
          Boolean(p?.keys?.remoteId) === online &&
          p.attributes.name === 'Scripture'
      );
      if (pts.length > 0) {
        pt = pts[0] as ProjectType;
        memory.update((t) => [
          ...ReplaceRelatedRecord(t, proj, 'projecttype', 'projecttype', pt.id),
        ]);
        return pt.attributes.name;
      }
    }
    return 'Scripture';
  };

  const setProjectType = (projectId: string) => {
    const pt = getProjType(projectId);
    if (pt !== getGlobal('projType')) setProjType(pt);
    return pt;
  };

  return { setProjectType, getProjType };
};
