import { useEffect, useState } from 'react';
import { useSelector, shallowEqual } from 'react-redux';
import { useGlobal } from '../context/useGlobal';
import { usePeerGroups } from '../components/Peers/usePeerGroups';
import { IPermissionStrings } from '../model';
import { permissionsSelector } from '../selector';
import { onlyUnique } from '../utils';
import remoteId, { remoteIdGuid } from './remoteId';
import { RecordKeyMap } from '@orbit/records';

export enum PermissionName {
  //Admin = 'admin',
  //MTTranscriber = 'mtTranscriber',
  //LWCTranscriber = 'lwcTranscriber',
  //Editor = 'transcriptionEditor',
  //Consultant = 'consultant',
  Mentor = 'mentor',
  CIT = 'consultantInTraining',
}
export const usePermissions = () => {
  const [user] = useGlobal('user');
  const [memory] = useGlobal('memory');
  const [permissions, setPermissions] = useState('');
  const t = useSelector(
    permissionsSelector,
    shallowEqual
  ) as IPermissionStrings;
  const { myGroups } = usePeerGroups();

  useEffect(() => {
    const perms: string[] = [];

    myGroups.forEach((g) => {
      if (g.attributes?.permissions) {
        const p = JSON.parse(g.attributes.permissions);
        perms.push(p.permissions.split());
      }
    });
    const newValue = perms.filter(onlyUnique).sort().join();
    if (permissions !== newValue) setPermissions(newValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myGroups]);

  const getPermissionFromJson = (jsonstr: string) => {
    if (jsonstr.trimStart().charAt(0) === '{') {
      const json = JSON.parse(jsonstr);
      return json.permissions || '';
    }
    return jsonstr;
  };
  const localizePermission = (p: PermissionName | string) => {
    if (typeof p === 'string') {
      p = getPermissionFromJson(p);
    }
    if (!p) return '';
    return Object.prototype.hasOwnProperty.call(t, p)
      ? t.getString(p)
      : (Object.keys(PermissionName)
          .filter((pk) => (PermissionName as any)[pk] === p)
          .pop() ?? p);
  };
  const permissionTip = (p: PermissionName | string) => {
    if (!p) return t.nspTip;
    return Object.prototype.hasOwnProperty.call(t, p + 'Tip')
      ? t.getString(p + 'Tip')
      : '';
  };
  const allPermissions = () => Object.values(PermissionName);

  const localizedPermissions = () => {
    return allPermissions().map((p) => localizePermission(p));
  };

  //given a string of json {mentor:true, consultantInTraining:true, author: userid, approved: false}
  const canAccess = (perms: string) => {
    if (!perms) return true;
    const json = JSON.parse(perms);
    //nothing here so everyone can see it
    if (Object.keys(json).length === 0) return true;
    //has been approved
    if (Object.prototype.hasOwnProperty.call(json, 'approved') && json.approved)
      return true;

    let canI = false;
    permissions.split(',').forEach((p) => {
      if (Object.prototype.hasOwnProperty.call(json, p)) canI = canI || json[p];
    });
    return canI;
  };

  const addAccess = (json: any, perm: PermissionName) => {
    json[perm] = true;
    return { ...json };
  };
  const addNeedsApproval = (json: any) => {
    return {
      ...json,
      approved: false,
      author: remoteId('user', user, memory?.keyMap as RecordKeyMap) ?? user,
    };
  };

  const approvalStatus = (perms: string) => {
    if (!perms) return undefined;
    const json = JSON.parse(perms);
    if (Object.keys(json).length === 0) return undefined;
    return json.approved;
  };

  const approve = (approved: boolean, perms?: string) => {
    if (!perms) return {};
    const json = JSON.parse(perms);
    return { ...json, approved };
  };

  const getMentorAuthor = (perms: string) => {
    if (!perms) return undefined;
    const json = JSON.parse(perms);
    if (Object.keys(json).length === 0) return undefined;
    return (
      remoteIdGuid('user', json['author'], memory?.keyMap as RecordKeyMap) ??
      json['author']
    );
  };

  //given one permission "mentor"
  const hasPermission = (perm: PermissionName) => permissions.includes(perm);

  return {
    permissions,
    addAccess,
    canAccess,
    addNeedsApproval,
    approvalStatus,
    approve,
    hasPermission,
    allPermissions,
    localizePermission,
    localizedPermissions,
    permissionTip,
    getMentorAuthor,
    getPermissionFromJson,
  };
};
