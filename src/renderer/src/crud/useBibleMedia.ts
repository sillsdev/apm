import { useCallback } from 'react';
import { useGlobal } from '../context/useGlobal';
import { OrganizationD, PlanD, ProjectD } from '../model';

export const useBibleMedia = () => {
  const [memory] = useGlobal('memory');
  // Memoized so consumers can list these in effect deps without re-firing every
  // render. memory is a stable global, so it's intentionally left out of the
  // dependency lists (matching the repo convention).
  const getBibleMediaTeam = useCallback(async () => {
    let orgs = memory?.cache.query((q) =>
      q
        .findRecords('organization')
        .filter({ attribute: 'name', value: 'BibleMedia' })
    ) as OrganizationD[];
    if (orgs.length === 0) {
      orgs = await memory.query((q) =>
        q
          .findRecords('organization')
          .filter({ attribute: 'name', value: 'BibleMedia' })
      );
    }
    return orgs[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const getBibleMediaProject = useCallback(async () => {
    let projects = memory?.cache.query((q) =>
      q
        .findRecords('project')
        .filter({ attribute: 'name', value: 'BibleMedia' })
    ) as ProjectD[];
    if (projects.length === 0) {
      projects = (await memory.query((q) =>
        q
          .findRecords('project')
          .filter({ attribute: 'name', value: 'BibleMedia' })
      )) as ProjectD[];
    }
    return projects[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getBibleMediaPlan = useCallback(async () => {
    let plans = memory?.cache.query((q) =>
      q.findRecords('plan').filter({ attribute: 'name', value: 'BibleMedia' })
    ) as PlanD[];
    if (plans.length === 0) {
      await getBibleMediaProject();
      plans = await memory.query((q) =>
        q.findRecords('plan').filter({ attribute: 'name', value: 'BibleMedia' })
      );
    }
    return plans[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return {
    getBibleMediaTeam,
    getBibleMediaProject,
    getBibleMediaPlan,
  };
};
