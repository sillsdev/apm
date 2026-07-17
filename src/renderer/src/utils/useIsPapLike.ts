import React from 'react';
import { TeamContext } from '../context/TeamContext';
import { useGlobal } from '../context/useGlobal';

/**
 * True when the signed-in user is Work-Alone-Offline / PAP-like: only a personal
 * team exists and we can trust that emptiness. Detect "Work Alone Offline" via the
 * `offlineOnly` global — NOT `teams.length === 0` alone, which is also true for a
 * normal user who simply hasn't joined a team yet.
 *
 * When offline && !offlineOnly, getTeams() may be empty because shared teams
 * without local projects are filtered out — not the same as true PAP-only.
 */
export const useIsPapLike = (): boolean => {
  const ctx = React.useContext(TeamContext);
  const { teams, personalTeam, teamDirectoryReady } = ctx.state;
  const [isOffline] = useGlobal('offline');
  const [offlineOnly] = useGlobal('offlineOnly');
  return (
    Boolean(personalTeam) &&
    teams.length === 0 &&
    teamDirectoryReady &&
    (!isOffline || offlineOnly)
  );
};
