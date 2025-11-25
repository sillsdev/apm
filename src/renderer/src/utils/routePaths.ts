/**
 * Attempts to derive the organization (team) ID from the currently selected plan.
 *
 * This function follows a chain of relationships: Plan -> Project -> Organization
 * by reading from localStorage and querying the in-memory Orbit store.
 *
 * @returns The organization ID if successfully derived, or `null` in the following cases:
 *   - No plan is stored in localStorage under the `LocalKey.plan` key
 *   - The stored plan ID doesn't exist in the memory store
 *   - The plan record has no associated project
 *   - The project record doesn't exist in the memory store
 *   - The project record has no associated organization
 *   - Any error occurs during the lookup process (JSON parsing, store queries, etc.)
 *
 * @remarks
 * This function uses a defensive error handling strategy where all exceptions are
 * silently caught and converted to `null`. This prevents the application from
 * crashing due to corrupted localStorage data, schema mismatches, or store
 * inconsistencies, but may hide legitimate errors. The trade-off prioritizes
 * application stability over error visibility.
 *
 * Expected data flow:
 * 1. Read plan ID from localStorage
 * 2. Find plan record in memory store
 * 3. Extract related project ID from plan
 * 4. Find project record in memory store
 * 5. Extract related organization ID from project
 */
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
