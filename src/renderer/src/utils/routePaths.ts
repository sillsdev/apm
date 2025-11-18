import { memory } from '../schema';

// Fallback static home route (teams directory) used when no contextual team is known
export const TEAMS = '/teams';

export const buildHomeRoute = (teamId?: string | null) =>
  teamId ? `/projects/${teamId}` : TEAMS;

const SELECTED_PLAN_KEY = 'selected-plan';

// Attempt to derive the organization (team) id from the selected plan.
const deriveTeamIdFromPlan = (): string | null => {
  const stored = localStorage.getItem(SELECTED_PLAN_KEY);
  if (!stored) return null; // nothing selected
  const keyMap: any = (memory as any)?.keyMap;
  // Always try remoteId -> id mapping first (cheap); fall back to stored value
  const internalId = keyMap?.idFromKey?.('plan', 'remoteId', stored) || stored;
  try {
    const planRec: any = memory?.cache?.query((q) =>
      q.findRecord({ type: 'plan', id: internalId })
    );
    if (!planRec) return null;
    const projectId = planRec.relationships?.project?.data?.id;
    if (!projectId) return null;
    const projectRec: any = memory?.cache?.query((q) =>
      q.findRecord({ type: 'project', id: projectId })
    );
    const orgId = projectRec?.relationships?.organization?.data?.id || null;
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
