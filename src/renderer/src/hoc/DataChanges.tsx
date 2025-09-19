import {
  useState,
  useEffect,
  useRef,
  useContext,
  useMemo,
  PropsWithChildren,
  useCallback,
} from 'react';
import { useGetGlobal, useGlobal } from '../context/useGlobal';
import { infoMsg, logError, Severity, useCheckOnline } from '../utils';
import { useInterval } from '../utils/useInterval';
import Memory from '@orbit/memory';
import JSONAPISource from '@orbit/jsonapi';
import { isElectron, OrbitNetworkErrorRetries } from '../../api-variable';
import { findRecord, useFetchUrlNow } from '../crud';
import { electronExport } from '../store/importexport/electronExport';
import { useOfflnProjRead } from '../crud/useOfflnProjRead';
import { ExportType, UserD } from '../model';
import * as actions from '../store';
import { TokenContext } from '../context/TokenProvider';
import { UnsavedContext } from '../context/UnsavedContext';
import { useSanityCheck } from '../crud/useSanityCheck';
import { useBibleMedia } from '../crud/useBibleMedia';
import { useDispatch } from 'react-redux';
import { useOrbitData } from './useOrbitData';
import { doDataChanges } from './doDataChanges';

export function DataChanges(props: PropsWithChildren) {
  const { children } = props;
  const dispatch = useDispatch();
  const setLanguage = (lang: string) =>
    dispatch(actions.setLanguage(lang) as any);
  const [isOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [coordinator] = useGlobal('coordinator');
  const memory = coordinator?.getSource('memory') as Memory;
  const remote = coordinator?.getSource('remote') as JSONAPISource; //to check busy
  const [loadComplete] = useGlobal('loadComplete');
  const [, setBusy] = useGlobal('remoteBusy');
  const [, setDataChangeCount] = useGlobal('dataChangeCount');
  const [connected] = useGlobal('connected'); //verified this is not used in a function 2/18/25
  const [user] = useGlobal('user');
  const [fingerprint] = useGlobal('fingerprint');
  const [errorReporter] = useGlobal('errorReporter');
  const ctx = useContext(TokenContext).state;
  const { authenticated } = ctx;
  const [busyDelay, setBusyDelay] = useState<number | null>(null);
  const [dataDelay, setDataDelay] = useState<number | null>(null);
  const [firstRun, setFirstRun] = useState(true);
  const doingChanges = useRef(false);
  const getOfflineProject = useOfflnProjRead();
  const checkOnline = useCheckOnline('DataChanges');
  const { anySaving, toolsChanged } = useContext(UnsavedContext).state;
  const defaultBackupDelay = isOffline ? 1000 * 60 * 30 : null; //30 minutes;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saving = useMemo(() => anySaving(), [toolsChanged]);
  const doSanityCheck = useSanityCheck(setLanguage);
  const { getBibleMediaProject, getBibleMediaPlan } = useBibleMedia();
  const fetchUrl = useFetchUrlNow();
  const users = useOrbitData<UserD[]>('user');
  const defaultDataDelayInMinutes = 2;
  const [userDataDelay, setUserDataDelay] = useState(defaultDataDelayInMinutes);
  const getGlobal = useGetGlobal();
  useEffect(() => {
    const userRec = findRecord(memory, 'user', user) as UserD; //make sure we have the user record in memory
    const hk = JSON.parse(userRec?.attributes?.hotKeys ?? '{}');
    setUserDataDelay(hk.syncFreq ?? defaultDataDelayInMinutes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, user]);

  useEffect(() => {
    const defaultBusyDelay = 1000;
    const defaultDataDelay = 1000 * (userDataDelay * 60);

    setFirstRun(dataDelay === null);
    //if userDataDelay = 0, then we don't want to sync but don't set it to null
    //because that means we haven't run yet.
    const newDelay =
      connected && loadComplete && remote && authenticated()
        ? dataDelay === null
          ? 10
          : defaultDataDelay
        : null;
    setDataDelay(newDelay);

    if (!remote) setBusy(false);
    // the busy delay is increased by 10 times if we aren't connected yet
    // but should be because we have authenticated.
    setBusyDelay(
      remote && authenticated() ? defaultBusyDelay * (connected ? 1 : 10) : null
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, ctx, loadComplete, connected, firstRun, userDataDelay]);

  const updateBusy = useCallback(() => {
    const checkBusy =
      getGlobal('user') === '' ||
      (remote && remote.requestQueue.length !== 0) ||
      getGlobal('orbitRetries') < OrbitNetworkErrorRetries;
    //we know we're offline, or we've retried something so maybe we're offline
    if (!getGlobal('connected') || checkBusy) {
      checkOnline((result) => {
        if ((checkBusy && result) !== getGlobal('remoteBusy')) {
          setBusy(checkBusy && result);
        }
      });
    } else if (checkBusy !== getGlobal('remoteBusy')) {
      setBusy(checkBusy);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, user]);

  const updateData = async () => {
    if (
      !doingChanges.current &&
      !getGlobal('remoteBusy') &&
      !getGlobal('importexportBusy') &&
      !saving &&
      authenticated()
    ) {
      doingChanges.current = true; //attempt to prevent double calls
      const check = firstRun;
      setFirstRun(false);
      await doDataChanges(
        ctx.accessToken || '',
        coordinator,
        fingerprint,
        getGlobal('projectsLoaded'),
        getOfflineProject,
        errorReporter,
        user,
        setLanguage,
        setDataChangeCount,
        isElectron ? fetchUrl : undefined
      );
      if (check) {
        //make sure we have a bible media project and plan downloaded
        await getBibleMediaPlan();
        const bibleMediaProject = await getBibleMediaProject();
        if (bibleMediaProject) await doSanityCheck(bibleMediaProject.id);
        for (let ix = 0; ix < getGlobal('projectsLoaded').length; ix++)
          await doSanityCheck(getGlobal('projectsLoaded')[ix] as string);
      }
      doingChanges.current = false; //attempt to prevent double calls
    }
  };

  const backupElectron = () => {
    if (!getGlobal('remoteBusy') && !saving && getGlobal('project') !== '') {
      electronExport(
        ExportType.ITFBACKUP,
        undefined, //all artifact types
        memory,
        undefined,
        getGlobal('project'),
        user,
        '',
        '',
        getOfflineProject
      ).catch((err: Error) => {
        logError(
          Severity.error,
          errorReporter,
          infoMsg(err, 'Backup export failed: ')
        );
      });
    }
  };
  useInterval(updateBusy, busyDelay);
  useInterval(updateData, (dataDelay ?? 0) <= 0 ? null : dataDelay);
  useInterval(backupElectron, defaultBackupDelay);
  // render the children component.
  return children as JSX.Element;
}
export default DataChanges;
