import React from 'react';
import { TeamContext } from '../context/TeamContext';
import { useGlobal } from '../context/useGlobal';

/**
 * True when the signed-in user is Work-Alone-Offline / PAP-like
 *
 * Detect "Work Alone Offline" via the `offlineOnly` global — `teams.length
 * === 0` alone is not enough as it is also true for a normal user who simply hasn't joined a team yet.
 * And not `!offline` (an online first-time user is online but still needs Switch
 * Teams / Add Team). `offlineOnly` is set at login for users with no remoteId
 * (see Access.tsx) and is the single reliable signal.
 */
export const useIsPapLike = (): boolean => {
  const ctx = React.useContext(TeamContext);
  const { teams, personalTeam, teamDirectoryReady } = ctx.state;
  const [offlineOnly] = useGlobal('offlineOnly');
  return Boolean(
    personalTeam && teams.length === 0 && teamDirectoryReady && offlineOnly
  );
};
