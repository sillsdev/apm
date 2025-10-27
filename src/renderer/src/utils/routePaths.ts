import { findRecord, related } from '../crud';
import { memory } from '../schema';
import { LocalKey } from './localUserKey';
import { PlanD } from '@model/plan';
import { ProjectD } from '@model/project';

// Fallback static home route (teams directory) used when no contextual team is known
export const TEAMS = '/teams';

export const buildHomeRoute = (teamId?: string | null) =>
  teamId ? `/projects/${teamId}` : TEAMS;

// Attempt to derive the organization (team) id from the selected plan.
const deriveTeamIdFromPlan = (): string | null => {
  const stored = localStorage.getItem(LocalKey.plan);
  if (!stored) return null; // nothing selected
  try {
    const planRec = findRecord(memory, 'plan', stored) as PlanD | undefined;
    if (!planRec) return null;
    const projectId = related(planRec, 'project') as string;
    if (!projectId) return null;
    const projectRec = findRecord(memory, 'project', projectId) as
      | ProjectD
      | undefined;
    const orgId = related(projectRec, 'organization') || null;
    return orgId || null;
  } catch {
    return null;
  }
};

export const homeRoute = () => buildHomeRoute(deriveTeamIdFromPlan());

export const isHomeRoute = (path: string | undefined) =>
  !!path && (/^\/projects\/[^/]+$/i.test(path) || path === TEAMS);

// Predicate usable for regex-like checks (exact match, optional trailing slash)
export const homeRouteMatch = (path: string | undefined) =>
  !!path &&
  (/^\/projects\/[^/]+\/?$/i.test(path) || /^\/teams\/?$/i.test(path));

export const HOME_ROUTES = [TEAMS];
