import {
  RecordOperation,
  RecordTransformBuilder,
  RecordKeyMap,
} from '@orbit/records';
import Coordinator from '@orbit/coordinator';
import Memory from '@orbit/memory';
import JSONAPISource from '@orbit/jsonapi';
import { API_CONFIG, isElectron } from '../../api-variable';
import {
  IFetchNowProps,
  offlineProjectUpdateSnapshot,
  remoteId,
  remoteIdNum,
} from '../crud';
import { currentDateTime, localUserKey, LocalKey } from '../utils';
import { OfflineProject, PassageStateChangeD, Plan, VProject } from '../model';
import IndexedDBSource from '@orbit/indexeddb';
import * as actions from '../store';
import { processDataChanges } from './processDataChanges';

export const doDataChanges = async (
  token: string,
  coordinator: Coordinator,
  fingerprint: string,
  projectsLoaded: string[],
  getOfflineProject: (plan: string | Plan | VProject) => OfflineProject,
  errorReporter: any,
  user: string,
  setLanguage: typeof actions.setLanguage,
  setDataChangeCount: (value: number) => void,
  fetchUrl?: (props: IFetchNowProps) => Promise<string | undefined>,
  notPastTime?: string
) => {
  const memory = coordinator?.getSource('memory') as Memory;
  const remote = coordinator?.getSource('remote') as JSONAPISource; //to check busy
  const backup = coordinator?.getSource('backup') as IndexedDBSource;
  const userLastTimeKey = localUserKey(LocalKey.time);
  const userNextStartKey = localUserKey(LocalKey.start);
  if (!remote || !remote.activated) return;
  let startNext = 0;
  let lastTime = localStorage.getItem(userLastTimeKey) || currentDateTime(); // should not happen
  if (notPastTime && Date.parse(lastTime) > Date.parse(notPastTime))
    lastTime = notPastTime;
  const nextTime = currentDateTime();

  const updateSnapshotDate = async (
    pid: string,
    newDate: string,
    start: number
  ) => {
    const oparray: RecordOperation[] = [];
    offlineProjectUpdateSnapshot(pid, oparray, memory, newDate, start, false);
    await backup.sync(() => oparray);
    await memory.sync(() => oparray);
  };

  const version = backup.cache.dbVersion;

  const api = API_CONFIG.host + '/api/datachanges/v' + version.toString() + '/';
  let start = 1;
  let tries = 5;
  if (isElectron) {
    for (let ix = 0; ix < projectsLoaded.length; ix++) {
      const p = projectsLoaded[ix] as string;
      const op = getOfflineProject(p);
      if (
        !isNaN(remoteIdNum('project', p, memory?.keyMap as RecordKeyMap)) &&
        op.attributes?.snapshotDate &&
        Date.parse(op.attributes.snapshotDate) < Date.parse(lastTime)
      ) {
        start = 0;
        startNext = 0;
        tries = 5;
        while (startNext >= 0 && tries > 0) {
          startNext = await processDataChanges({
            token,
            api: `${api}${startNext}/project/${fingerprint}`,
            params: new URLSearchParams([
              [
                'projlist',
                JSON.stringify({
                  id: remoteId('project', p, memory?.keyMap as RecordKeyMap),
                  since: op.attributes.snapshotDate,
                }),
              ],
            ]),
            started: start,
            coordinator,
            user,
            errorReporter,
            setLanguage,
            setDataChangeCount,
            fetchUrl,
          });
          if (startNext === start) tries--;
          else start = startNext;
        }

        if (startNext === -1)
          await updateSnapshotDate(p, nextTime, startNext + 1); //done
        else if (startNext > 0)
          //network error but not a known unrecoverable one so don't move on
          await updateSnapshotDate(p, op.attributes.snapshotDate, startNext);
      }
    }
  }
  startNext = parseInt(localStorage.getItem(userNextStartKey) || '0', 10);
  start = 1;
  tries = 5;
  while (startNext >= 0 && tries > 0) {
    startNext = await processDataChanges({
      token,
      api: `${api}${startNext}/since/${lastTime}?origin=${fingerprint}`,
      params: undefined,
      started: start,
      coordinator,
      user,
      errorReporter,
      setLanguage,
      setDataChangeCount,
      fetchUrl,
    });
    if (startNext === start) tries--;
    else start = startNext;
  }
  if (startNext === -1) localStorage.setItem(userLastTimeKey, nextTime);
  if (startNext !== -2)
    localStorage.setItem(userNextStartKey, (startNext + 1).toString());
  else {
    if (version === 6) {
      const operations: RecordOperation[] = [];
      //clean up abandoned pscs
      const pscs = (
        memory.cache.query((q) =>
          q.findRecords('passagestatechange')
        ) as PassageStateChangeD[]
      ).filter((p) => !p.keys?.remoteId);
      if (pscs.length > 0) {
        const tb = new RecordTransformBuilder();
        pscs.forEach((p) =>
          operations.push(
            tb.removeRecord({ type: p?.type, id: p.id }).toOperation()
          )
        );
        await backup.sync(() => operations);
        await memory.sync(() => operations);
      }
    }
  }
};
