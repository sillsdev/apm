import { useState, useEffect, useMemo } from 'react';
import { useGlobal } from '../../context/useGlobal';
import { User, GroupD, GroupMembership } from '../../model';
import { PermissionName, related, useAllUserGroup, useUser } from '../../crud';
import { useOrbitData } from '../../hoc/useOrbitData';

export interface IUserName {
  userId: string;
  name: string;
}

export const usePeerGroups = (team?: string) => {
  const users = useOrbitData<User[]>('user');
  const groups = useOrbitData<GroupD[]>('group');
  const memberships = useOrbitData<GroupMembership[]>('groupmembership');
  const [organization] = useGlobal('organization');
  // Follow the current team; a value frozen at mount goes stale when the
  // team changes while the consumer stays mounted (TT-7888).
  const org = team ?? organization;
  const allUsersGroup = useAllUserGroup();
  const { getUserRec } = useUser();
  const [userNames, setUserNames] = useState<IUserName[]>([]);
  const [peerGroups, setPeerGroups] = useState<GroupD[]>([]);
  const [check, setCheck] = useState<string[]>();
  const [user] = useGlobal('user');
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here

  const cKey = (userId: string, groupId: string) => `${userId}_${groupId}`;

  const cAdd = (v: string, c: string[]) => {
    if (!c.includes(v)) {
      c.push(v);
      setCheck(c.sort());
    }
  };

  const cDelete = (v: string, c: string[]) => {
    if (c.includes(v)) {
      c.splice(c.indexOf(v), 1);
      setCheck(c.sort());
    }
  };

  const allUserId = useMemo(
    () => allUsersGroup(org)?.id,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [org]
  );

  useEffect(() => {
    const memberIds = memberships
      .filter((m) => related(m, 'group') === allUserId)
      .map((m) => related(m, 'user'));

    setUserNames(
      memberIds.map((id) => {
        const userRec = getUserRec(id) as User;
        return { userId: id, name: userRec?.attributes?.name };
      })
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memberships, org, users]);

  // Derived during render so permissions are known on the first render and
  // follow later group changes (e.g. a group loading or its permission being
  // edited after mount). TT-7888: this used to be effect state that ignored
  // `groups`, so a group arriving or changing after mount was never seen.
  const myGroups = useMemo(() => {
    const groupIds = memberships
      .filter((m) => related(m, 'user') === user)
      .map((om) => related(om, 'group'));
    return groups.filter(
      (g) =>
        g?.attributes &&
        !g.attributes?.allUsers &&
        groupIds.includes(g.id) &&
        related(g, 'owner') === org
    );
  }, [memberships, groups, org, user]);

  useEffect(() => {
    setPeerGroups(
      groups.filter(
        (g) =>
          g?.attributes &&
          !g.attributes?.allUsers &&
          related(g, 'owner') === org
      )
    );
  }, [groups, org]);

  useEffect(() => {
    const users = userNames.map((r) => r.userId);
    const grps = peerGroups.map((c) => c.id);
    const checks = new Set<string>();
    memberships.forEach((m) => {
      const u = related(m, 'user');
      const g = related(m, 'group');
      if (users.includes(u) && grps.includes(g)) checks.add(cKey(u, g));
    });
    setCheck(Array.from(checks));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userNames, peerGroups]);

  const getGroupId = function (name: string): string {
    const findit = groups.filter(
      (r) =>
        r.attributes &&
        r.attributes.name === name &&
        offlineOnly === Boolean(r?.keys?.remoteId)
    );
    if (findit.length > 0) return findit[0].id;
    return '';
  };

  const citGroup = useMemo(
    () =>
      peerGroups.filter((g) =>
        g.attributes.permissions?.includes(PermissionName.CIT)
      ).length > 0
        ? peerGroups.filter((g) =>
            g.attributes.permissions?.includes(PermissionName.CIT)
          )[0]
        : undefined,
    [peerGroups]
  );
  const mentorGroup = useMemo(
    () =>
      peerGroups.filter((g) =>
        g.attributes.permissions?.includes(PermissionName.Mentor)
      ).length > 0
        ? peerGroups.filter((g) =>
            g.attributes.permissions?.includes(PermissionName.Mentor)
          )[0]
        : undefined,
    [peerGroups]
  );
  return {
    userNames,
    peerGroups,
    check,
    cAdd,
    cDelete,
    cKey,
    myGroups,
    getGroupId,
    citGroup,
    mentorGroup,
  };
};
