import { useMemo, useRef } from 'react';
import { useGlobal } from '../context/useGlobal';
import {
  Organization,
  RoleNames,
  ISharedStrings,
  OrganizationD,
  OrganizationMembershipD,
  GroupMembershipD,
  GroupD,
} from '../model';
import {
  useCheckOnline,
  cleanFileName,
  localUserKey,
  LocalKey,
} from '../utils';
import {
  offlineError,
  useArtifactCategory,
  useOrgWorkflowSteps,
  useProjectType,
  useRole,
  waitForRemoteId,
} from '.';
import { useSnackBar } from '../hoc/SnackBar';
import Memory from '@orbit/memory';
import { setDefaultProj } from '.';
import { AddRecord, ReplaceRelatedRecord } from '../model/baseModel';
import { useTeamApiPull } from './useTeamApiPull';
import { shallowEqual, useSelector } from 'react-redux';
import { sharedSelector } from '../selector';
import {
  RecordIdentity,
  RecordKeyMap,
  RecordOperation,
  RecordTransformBuilder,
} from '@orbit/records';
import useAllUsersRec from './useAllUsers';

export const useTeamCreate = () => {
  const { CreateOrgWorkflowSteps } = useOrgWorkflowSteps();
  const [coordinator] = useGlobal('coordinator');
  const [user] = useGlobal('user');
  const [, setOrganization] = useGlobal('organization');
  const [, setOrgRole] = useGlobal('orgRole');
  const [, setProject] = useGlobal('project');
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const { showMessage } = useSnackBar();
  const { setProjectType } = useProjectType();
  const { getRoleId } = useRole();
  const allUsersRec = useAllUsersRec();
  const teamApiPull = useTeamApiPull();
  const checkOnline = useCheckOnline('Team Create');
  const workingOnItRef = useRef(false);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const { AddOrgNoteCategoryOps } = useArtifactCategory();

  const memory = useMemo(
    () => coordinator?.getSource('memory') as Memory,
    [coordinator]
  );

  const orgRoleId = useMemo(() => getRoleId(RoleNames.Admin), [getRoleId]);

  // Creates the all-users group (if needed) and the org membership. These only
  // depend on the organization id. The group membership is created separately
  // (GroupMemberRelated) after the group has a remote id.
  const OrgRelated = (t: RecordTransformBuilder, orgRec: OrganizationD) => {
    const opArray: RecordOperation[] = [];

    const orgMember: OrganizationMembershipD = {
      type: 'organizationmembership',
      attributes: {},
    } as OrganizationMembershipD;

    let allUsersGroup = allUsersRec(orgRec.id);
    const isNewGroup = !allUsersGroup;
    if (!allUsersGroup) {
      const group: GroupD = {
        type: 'group',
        attributes: {
          name: `All users of ${orgRec.attributes.name}`,
          abbreviation: `all-users`,
          allUsers: true,
        },
      } as GroupD;
      opArray.push(
        ...[
          ...AddRecord(t, group, user, memory),
          ...ReplaceRelatedRecord(t, group, 'owner', 'organization', orgRec.id),
        ]
      );
      allUsersGroup = group;
    }
    opArray.push(
      ...[
        ...AddRecord(t, orgMember, user, memory),
        ...ReplaceRelatedRecord(t, orgMember, 'user', 'user', user),
        ...ReplaceRelatedRecord(
          t,
          orgMember,
          'organization',
          'organization',
          orgRec.id
        ),
        ...ReplaceRelatedRecord(t, orgMember, 'role', 'role', orgRoleId),
      ]
    );
    return { opArray, allUsersGroup: allUsersGroup as GroupD, isNewGroup };
  };

  // Creates the group membership. Must run after the all-users group has a
  // remote id so the 'group' relationship doesn't serialize as null.
  const GroupMemberRelated = (
    t: RecordTransformBuilder,
    allUsersGroup: GroupD
  ): RecordOperation[] => {
    const groupMbr: GroupMembershipD = {
      type: 'groupmembership',
      attributes: {},
    } as GroupMembershipD;
    return [
      ...AddRecord(t, groupMbr, user, memory),
      ...ReplaceRelatedRecord(t, groupMbr, 'user', 'user', user),
      ...ReplaceRelatedRecord(t, groupMbr, 'group', 'group', allUsersGroup?.id),
      ...ReplaceRelatedRecord(t, groupMbr, 'role', 'role', orgRoleId),
    ];
  };

  interface ICreateOrgProps {
    orgRec: Organization;
    process: string;
  }

  const createOrg = async (props: ICreateOrgProps) => {
    const { orgRec, process } = props;

    const t = new RecordTransformBuilder();
    const orgOps: RecordOperation[] = [
      ...AddRecord(t, orgRec, user, memory),
      ...ReplaceRelatedRecord(
        t,
        orgRec as RecordIdentity,
        'owner',
        'user',
        user
      ),
    ];
    await memory.update(orgOps);
    // The all-users group's owner, the memberships, note categories and
    // workflow steps all reference this organization. Wait for its remote id
    // before creating them; otherwise the dependent records serialize the
    // organization relationship as null on the server (e.g. group owner null).
    if (!offlineOnly)
      await waitForRemoteId(
        { type: 'organization', id: orgRec.id as string },
        memory?.keyMap as RecordKeyMap
      );
    console.log('createOrg: remote id found', orgRec.id);
    const tb = new RecordTransformBuilder();
    const {
      opArray: relatedOps,
      allUsersGroup,
      isNewGroup,
    } = OrgRelated(tb, orgRec as OrganizationD);
    const opArray: RecordOperation[] = [...relatedOps];
    opArray.push(...AddOrgNoteCategoryOps(tb, orgRec.id));
    CreateOrgWorkflowSteps(tb, process, orgRec.id as string, opArray);
    await memory.update(opArray);

    // The group membership references the all-users group. If we just created
    // that group, wait for its remote id before creating the membership so the
    // 'group' relationship isn't serialized as null on the server.
    if (!offlineOnly && isNewGroup)
      await waitForRemoteId(
        { type: 'group', id: allUsersGroup.id as string },
        memory?.keyMap as RecordKeyMap
      );

    const tbMbr = new RecordTransformBuilder();
    await memory.update(GroupMemberRelated(tbMbr, allUsersGroup));

    // the next line prevents shutting off busy until all workflow steps are created
    if (!offlineOnly) await teamApiPull(orgRec.id as string); // Update slug value
    setOrganization(orgRec.id as string);
    localStorage.setItem(localUserKey(LocalKey.team), orgRec.id as string);
    setOrgRole(RoleNames.Admin);
    setDefaultProj(orgRec.id as string, memory, (pid: string) => {
      setProject(pid);
      setProjectType(pid);
    });

    return orgRec.id as string;
  };

  return (
    organization: Organization,
    process: string,
    cb?: (org: string) => void
  ) => {
    const {
      name,
      description,
      websiteUrl,
      logoUrl,
      publicByDefault,
      defaultParams,
    } = organization.attributes;
    const orgRec = {
      type: 'organization',
      attributes: {
        name,
        slug: cleanFileName(name), // real slugs are created by API
        description,
        websiteUrl,
        logoUrl,
        publicByDefault,
        defaultParams,
      },
    } as Organization;

    if (!workingOnItRef.current) {
      workingOnItRef.current = true;
      createOrg({ orgRec, process })
        .then((org: string) => {
          workingOnItRef.current = false;
          if (cb) cb(org);
        })
        .catch((err) => {
          checkOnline((online) => {
            workingOnItRef.current = false;
            offlineError({ ts, online, showMessage, err });
          });
        });
    }
  };
};
