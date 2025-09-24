import {
  RecordTransform,
  RecordTransformBuilder,
  RecordOperation,
  UpdateRecordOperation,
  RecordIdentity,
  RecordKeyMap,
} from '@orbit/records';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import JSONAPISource from '@orbit/jsonapi';
import { ChangeList, DataChange } from '../model/dataChange';
import { logError, Severity } from '../utils';
import {
  AcceptInvitation,
  findRecord,
  GetUser,
  IFetchNowProps,
  related,
  remoteIdGuid,
  SetUserLanguage,
} from '../crud';
import { Invitation, InvitationD, MediaFileD } from '../model';
import IndexedDBSource from '@orbit/indexeddb';
import * as actions from '../store';
import { ReplaceRelatedRecord } from '../model/baseModel';
import { pullRemoteToMemory } from '../crud/syncToMemory';
import { axiosGet } from '../utils/axios';

export const processDataChanges = async (pdc: {
  token: string | null;
  api: string;
  params: any;
  started: number;
  coordinator: Coordinator;
  user: string;
  errorReporter: any;
  setLanguage: typeof actions.setLanguage;
  setDataChangeCount: (value: number) => void;
  fetchUrl?: (props: IFetchNowProps) => Promise<string | undefined>;
  cb?: () => void;
}) => {
  const {
    token,
    api,
    params,
    started,
    coordinator,
    user,
    errorReporter,
    setLanguage,
    setDataChangeCount,
    fetchUrl,
    cb,
  } = pdc;

  const memory = coordinator?.getSource('memory') as Memory;
  const remote = coordinator?.getSource('datachanges') as JSONAPISource;
  const backup = coordinator?.getSource('backup') as IndexedDBSource;
  const reloadOrgs = async (localId: string, reloadAll: boolean) => {
    const orgmem = findRecord(memory, 'organizationmembership', localId);
    if (orgmem) {
      if (related(orgmem, 'user') === user) {
        for (const table of [
          'organization',
          'orgworkflowstep',
          'organizationmembership',
          'organizationbible',
        ]) {
          await pullRemoteToMemory({ table, memory, remote });
        }
      }
    } else {
      if (reloadAll)
        await pullRemoteToMemory({
          table: 'organizationmembership',
          memory,
          remote,
        });
      return true;
    }
    return false;
  };

  const reloadProjects = async (localId: string, reloadAll: boolean) => {
    const grpmem = findRecord(memory, 'groupmembership', localId);
    if (grpmem) {
      if (related(grpmem, 'user') === user) {
        for (const table of ['group', 'project', 'plan', 'groupmembership']) {
          await pullRemoteToMemory({ table, memory, remote });
        }
      }
    } else {
      if (reloadAll)
        await pullRemoteToMemory({ table: 'groupmembership', memory, remote });
      return true;
    }
    return false;
  };
  const processTableChanges = async (
    transforms: RecordTransform[],
    isUser: boolean,
    fetchUrl?: (props: IFetchNowProps) => Promise<string | undefined>,
    cb?: () => void
  ) => {
    const setRelated = (
      newOps: RecordOperation[],
      tb: RecordTransformBuilder,
      relationship: string,
      record: RecordIdentity,
      value: string
    ) => {
      let table = relationship;
      switch (relationship) {
        case 'transcriber':
        case 'editor':
          table = 'user';
      }
      newOps.push(
        ...ReplaceRelatedRecord(tb, record, relationship, table, value)
      );
    };
    const resetRelated = (
      newOps: RecordOperation[],
      tb: RecordTransformBuilder,
      relationship: string,
      record: RecordIdentity
    ) => {
      setRelated(newOps, tb, relationship, record, '');
    };

    const DeleteLocalCopy = (
      offlineId: string | undefined | null,
      type: string,
      tb: RecordTransformBuilder,
      localOps: RecordOperation[]
    ) => {
      if (offlineId) {
        const myRecord = findRecord(memory, type, offlineId);
        if (myRecord) {
          localOps.push(
            tb
              .removeRecord({
                type: type,
                id: offlineId,
              })
              .toOperation()
          );
        }
      }
    };

    for (const tr of transforms) {
      const tb = new RecordTransformBuilder();
      const localOps: RecordOperation[] = [];
      let upRec: UpdateRecordOperation;

      let myOps = tr.operations;
      if (!Array.isArray(myOps)) myOps = [myOps];
      const ops = myOps.filter(
        (o) =>
          o.op !== 'updateRecord' ||
          Boolean((o as UpdateRecordOperation).record.relationships) ||
          ((o as UpdateRecordOperation).record.type === 'user' && isUser) //user doesn't have any
      );
      await backup.sync(() => ops);
      await memory.sync(() => ops);
      let reloadAllOrgs = false;
      let reloadAllProjects = false;
      for (const o of myOps) {
        if (o.op === 'updateRecord') {
          upRec = o as UpdateRecordOperation;
          if (
            !upRec.record.relationships &&
            !(isUser && upRec.record.type !== 'user')
          )
            //this is just an included record and wasn't changed
            continue;
          switch (upRec.record.type) {
            case 'section':
              if (upRec.record.relationships?.transcriber === undefined)
                resetRelated(localOps, tb, 'transcriber', upRec.record);
              if (upRec.record.relationships?.editor === undefined)
                resetRelated(localOps, tb, 'editor', upRec.record);
              break;

            case 'mediafile':
              //await CheckUploadLocal(upRec);
              DeleteLocalCopy(
                upRec.record.attributes?.offlineId as string | undefined,
                upRec.record.type,
                tb,
                localOps
              );
              if (upRec.record.relationships?.passage === undefined)
                resetRelated(localOps, tb, 'passage', upRec.record);
              const localId = remoteIdGuid(
                'mediafile',
                upRec.record?.keys?.remoteId ?? '',
                memory?.keyMap as RecordKeyMap
              );
              if (localId) {
                const mr = findRecord(
                  memory,
                  'mediafile',
                  localId
                ) as MediaFileD;
                if (related(mr, 'plan') === undefined)
                  setRelated(
                    localOps,
                    tb,
                    'plan',
                    mr,
                    (upRec.record.relationships?.plan?.data as RecordIdentity)
                      ?.id ?? ''
                  );
              }
              if (fetchUrl && upRec.record?.keys?.remoteId)
                await fetchUrl({
                  id: upRec.record.keys.remoteId,
                  cancelled: () => false,
                }); //downloads the file
              break;

            case 'user':
              SetUserLanguage(memory, user, setLanguage);
              break;

            case 'discussion':
            case 'comment':
            case 'intellectualproperty':
            case 'orgkeytermtarget':
            case 'passagestatechange':
              DeleteLocalCopy(
                upRec.record.attributes?.offlineId as string | undefined,
                upRec.record.type,
                tb,
                localOps
              );
              break;

            case 'invitation':
              const userrec = GetUser(memory, user);
              if (
                (upRec.record as Invitation).attributes?.email.toLowerCase() ===
                userrec?.attributes?.email.toLowerCase()
              )
                AcceptInvitation(remote, upRec.record as InvitationD);
              break;
            case 'organizationmembership':
              reloadAllOrgs =
                (await reloadOrgs(upRec.record.id, false)) || reloadAllOrgs;
              break;
            case 'groupmembership':
              reloadAllProjects =
                (await reloadProjects(upRec.record.id, false)) ||
                reloadAllProjects;
              break;
          }
        }
      }
      if (reloadAllOrgs) reloadOrgs('x', true);
      if (reloadAllProjects) reloadProjects('x', true);
      if (localOps.length > 0) {
        await backup.sync(() => localOps);
        await memory.sync(() => localOps);
      }
    }
    if (cb) cb();
  };

  try {
    const response = (await axiosGet(api, params, token)) as {
      data: DataChange | null;
    };
    const data = response?.data;
    if (data === null) return started;
    const changes = data?.attributes?.changes;
    const deletes = data?.attributes?.deleted;
    setDataChangeCount(changes.length + deletes.length);
    for (const table of changes) {
      if (table.ids.length > 0) {
        if (!remote) return started;
        const results = await remote.query(
          (q) =>
            q
              .findRecords(table.type)
              .filter({ attribute: 'id-list', value: table.ids.join('|') }),
          { fullResponse: true }
        );
        if (results?.transforms)
          await processTableChanges(
            results.transforms,
            table.type === 'user',
            fetchUrl,
            cb
          );
      }
    }
    setDataChangeCount(deletes.length);
    const tb: RecordTransformBuilder = new RecordTransformBuilder();

    for (let ix = 0; ix < deletes.length; ix++) {
      const table = deletes[ix] as ChangeList;
      const operations: RecordOperation[] = [];
      // eslint-disable-next-line no-loop-func
      table.ids.forEach((r) => {
        const localId = remoteIdGuid(
          table.type,
          r.toString(),
          memory?.keyMap as RecordKeyMap
        );
        if (localId) {
          switch (table.type) {
            case 'organizationmembership':
              reloadOrgs(localId, true);
              break;
            case 'groupmembership':
              reloadProjects(localId, true);
              break;
          }
          operations.push(
            tb.removeRecord({ type: table.type, id: localId }).toOperation()
          );
        }
      });
      if (operations.length > 0) {
        await backup.sync(() => operations);
        await memory.sync(() => operations);
      }
    }

    setDataChangeCount(0);
    return data?.attributes?.startnext;
  } catch (e: any) {
    logError(Severity.error, errorReporter, e);
    if ((e.response?.data?.errors?.length ?? 0) > 0) {
      const s = e.response.data.errors[0].detail?.toString();
      if (s.startsWith('Project not')) return -2;
    }
    return started;
  }
};
