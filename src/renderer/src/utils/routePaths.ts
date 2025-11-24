import { findRecord, related } from '../crud';
import { memory } from '../schema';
import { LocalKey } from './localUserKey';
import { PlanD } from '@model/plan';
import { ProjectD } from '@model/project';

// Fallback static home routes (teams directory) used when no contextual team is known
// Mobile breakpoint: screens below 768px are considered mobile
const MOBILE_BREAKPOINT = 768;

// Function to check if current screen width is mobile
export const isMobileWidth = (): boolean => {
  return window.innerWidth < MOBILE_BREAKPOINT;
};

export const MOBILETEAM = '/teams';

export const getTeamsRoute = (): string => {
  return MOBILETEAM;
};

const buildHomeRoute = (teamId?: string | null) =>
  teamId ? `/projects/${teamId}` : getTeamsRoute();

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
  !!path && (/^\/projects\/[^/]+$/i.test(path) || path === MOBILETEAM);

export const HOME_ROUTES = [MOBILETEAM];
