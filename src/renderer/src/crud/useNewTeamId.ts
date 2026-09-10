import React from 'react';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { Organization, OrganizationD, User } from '../model';
import { waitForIt } from '../utils';
import { useTeamCreate, isPersonalTeam, defaultWorkflow } from '.';
import related from './related';
import { pickPersonalOrganizationId } from './pickPersonalOrganizationId';

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
    // Prefer the oldest owned personal org so duplicate ">… Personal<" teams
    // resolve stably (TT-7397).
    const personalOrgs = orgs.filter(
      (o) => related(o, 'owner') === user && isPersonalTeam(o.id, orgs)
    );
    if (personalOrgs.length > 1) {
      console.error(`${personalOrgs.length} personal teams!`);
      console.log(personalOrgs);
    }
    return pickPersonalOrganizationId(personalOrgs);
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
