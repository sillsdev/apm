import React from 'react';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { Organization, OrganizationD, User } from '../model';
import { waitForIt } from '../utils';
import { useTeamCreate, isPersonalTeam, remoteIdNum, defaultWorkflow } from '.';
import related from './related';
import { RecordKeyMap } from '@orbit/records';

// Dedupe concurrent/remounted personal-team resolution+creation across
// TeamProvider mounts. Without this, two mounts racing before the first-created
// team is visible each run getPersonalId()->newPersonal() and spawn duplicate
// personal teams (the ">… Personal<" orgs). Module-level so it spans hook
// instances; cleared on completion so a later sequential login resolves fresh.
let personalIdInFlight: Promise<string> | null = null;

export const useNewTeamId = () => {
  const [memory] = useGlobal('memory');
  const teamRef = React.useRef<string | undefined>(undefined);
  const orbitTeamCreate = useTeamCreate();
  const getGlobal = useGetGlobal();

  const getPersonalId = async () => {
    await waitForIt(
      'have user for personal team',
      () => Boolean(getGlobal('user')),
      () => false,
      100
    );
    const user = getGlobal('user');
    const orgs = (await memory.query((q) =>
      q.findRecords('organization')
    )) as OrganizationD[];
    //Ugh, there's more than one per person.  Always get the last one created
    const orgRecs = orgs
      .filter((o) => related(o, 'owner') === user && isPersonalTeam(o.id, orgs))
      .sort((a, b) =>
        Boolean(a.keys?.remoteId) && Boolean(b.keys?.remoteId)
          ? remoteIdNum('organization', b.id, memory?.keyMap as RecordKeyMap) -
            remoteIdNum('organization', a.id, memory?.keyMap as RecordKeyMap)
          : b >= a
            ? 1
            : -1
      );
    if (orgRecs.length > 1) {
      console.error(`${orgRecs.length} personal teams!`);
      console.log(orgRecs);
    }
    return orgRecs.length > 0 ? orgRecs[0].id : undefined;
  };

  const newPersonal = async () => {
    if (!getGlobal('user')) return;
    teamRef.current = await getPersonalId();
    if (!teamRef.current) {
      const userRec = memory.cache.query((q) =>
        q.findRecord({ type: 'user', id: getGlobal('user') })
      ) as User;
      const userName = userRec?.attributes?.name ?? 'user';
      const personalOrg = `>${userName} Personal<`;
      orbitTeamCreate(
        {
          attributes: { name: personalOrg },
        } as Organization,
        defaultWorkflow,
        (org: string) => {
          teamRef.current = org;
        }
      );
    }
  };

  const resolvePersonalId = async (): Promise<string> => {
    const testId = await getPersonalId();
    if (testId) return testId;
    if (!getGlobal('offline') || getGlobal('offlineOnly')) {
      await newPersonal();
      await waitForIt(
        'create new team',
        () => teamRef.current !== undefined,
        () => false,
        100
      );
      return teamRef.current as string;
    }
    return '';
  };

  return async (teamIdType: string | undefined): Promise<string> => {
    if (teamIdType) return teamIdType;
    // Concurrent/remounted callers share one in-flight resolution so the
    // check-then-create path can't run twice and create duplicate personal
    // teams. Cleared on settle so a later sequential login resolves fresh.
    if (!personalIdInFlight) {
      personalIdInFlight = resolvePersonalId().finally(() => {
        personalIdInFlight = null;
      });
    }
    return personalIdInFlight;
  };
};
