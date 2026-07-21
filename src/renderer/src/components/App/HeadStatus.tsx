import { useEffect, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { Button, IconButton, Tooltip } from '@mui/material';
import CloudOnIcon from '@mui/icons-material/Cloud';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdateAlt';
import { DateTime } from 'luxon';
import { MainAPI } from '@model/main-api';
import { isElectron } from '../../../api-variable';
import packageJson from '../../../package.json';
import { IMainStrings, ISharedStrings, IState } from '../../model';
import { OfflineProject } from '../../model/offlineProject';
import { useGlobal, useGetGlobal } from '../../context/useGlobal';
import { mainSelector, sharedSelector } from '../../selector';
import { AlertSeverity, useSnackBar } from '../../hoc/SnackBar';
import { useOrbitData } from '../../hoc/useOrbitData';
import { useLoadProjectData } from '../../crud/useLoadProjectData';
import { useOfflineAvailToggle } from '../../crud/useOfflineAvailToggle';
import { useOfflnProjRead } from '../../crud/useOfflnProjRead';
import { usePlan } from '../../crud/usePlan';
import { useVProjectRead } from '../../crud/useVProjectRead';
import { axiosPost } from '../../utils/axios';
import { infoMsg } from '../../utils/infoMsg';
import { LocalKey } from '../../utils/localUserKey';
import logError, { Severity } from '../../utils/logErrorService';
import { Online } from '../../utils/useCheckOnline';
import { useMounted } from '../../utils/useMounted';

const ipc = window?.api as MainAPI;

interface HeadStatusProps {
  handleMenu: (what: string, cloud: boolean) => void;
  onVersion: (version: string) => void;
  onLatestVersion: (version: string) => void;
}

export default function HeadStatus({
  handleMenu,
  onVersion,
  onLatestVersion,
}: HeadStatusProps) {
  const getGlobal = useGetGlobal();
  const [errorReporter] = useGlobal('errorReporter');
  const isMounted = useMounted('headstatus');
  const { showMessage } = useSnackBar();
  const lang = useSelector((state: IState) => state.strings.lang);
  const t: IMainStrings = useSelector(mainSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

  // Checks for online or offline status

  const orbitStatus = useSelector((state: IState) => state.orbit.status);
  const [connected, setConnected] = useGlobal('connected');
  const [isOffline] = useGlobal('offline');
  const [isOfflineOnly] = useGlobal('offlineOnly');
  const [plan] = useGlobal('plan');
  const offlineProjects = useOrbitData<OfflineProject[]>('offlineproject');
  const [hasOfflineProjects, setHasOfflineProjects] = useState(false);
  const { getPlan } = usePlan();
  const offlineProjectRead = useOfflnProjRead();
  const vProject = useVProjectRead();
  const LoadData = useLoadProjectData();
  const offlineAvailToggle = useOfflineAvailToggle();

  useEffect(() => {
    const value = offlineProjects.some((p) => p?.attributes?.offlineAvailable);
    if (value !== hasOfflineProjects) setHasOfflineProjects(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineProjects]);

  const cloudAction = () => {
    localStorage.setItem(
      'mode',
      getGlobal('offline') ||
        orbitStatus !== undefined ||
        !getGlobal('connected')
        ? 'online-cloud'
        : 'online-local'
    );
    localStorage.setItem(LocalKey.plan, getGlobal('plan'));
    handleMenu('Logout', !getGlobal('offline'));
  };

  const handleSetOnline = (cb?: () => void) => {
    Online(true, (isConnected) => {
      if (getGlobal('connected') !== isConnected) {
        localStorage.setItem(LocalKey.connected, isConnected.toString());
        setConnected(isConnected);
      }
      if (!isConnected) {
        showMessage(ts.mustBeOnline);
        return;
      }
      cb && cb();
    });
  };

  const handleCloud = () => {
    handleSetOnline(() => {
      const planRec = getGlobal('plan')
        ? getPlan(getGlobal('plan'))
        : undefined;
      if (!planRec) {
        if (hasOfflineProjects) cloudAction();
        return;
      }
      const offlineProject = offlineProjectRead(vProject(planRec));
      if (offlineProject?.attributes?.offlineAvailable) {
        cloudAction();
      } else {
        LoadData(getGlobal('project'), () => {
          offlineAvailToggle(getGlobal('project'))
            .then(() => {
              cloudAction();
            })
            .catch((err: Error) => {
              // This used to be an unhandled rejection, which hid the real
              // cause behind whatever broke next (e.g. the "Go Offline" crash).
              logError(
                Severity.error,
                errorReporter,
                infoMsg(
                  err,
                  'offlineAvailToggle failed for project ' +
                    getGlobal('project')
                )
              );
            });
        });
      }
    });
  };

  // Checks for new versions or updates

  const { pathname } = useLocation();
  const [version, setVersion] = useState('');
  const [updates] = useState(
    (localStorage.getItem('updates') || 'true') === 'true'
  );
  const [latestVersion, setLatestVersion] = useGlobal('latestVersion');
  const [latestRelease, setLatestRelease] = useGlobal('releaseDate');
  const [updateTipOpen, setUpdateTipOpen] = useState(false);

  // Clicking the update icon closes the tip
  const closeUpdateTip = () => setUpdateTipOpen(false);

  const handleDownloadClick = () => {
    closeUpdateTip();
    if (ipc)
      ipc?.openExternal(
        'https://software.sil.org/audioprojectmanager/download/'
      );
    // remote?.getCurrentWindow().close();
  };

  useEffect(() => {
    if (isMounted()) {
      setVersion(packageJson.version);
      onVersion(packageJson.version);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  useEffect(() => {
    if (
      latestVersion === '' &&
      version !== '' &&
      updates &&
      localStorage.getItem(LocalKey.connected) !== 'false'
    ) {
      const bodyFormData = new FormData();
      bodyFormData.append('env', navigator.userAgent);
      axiosPost('userversions/2/' + version, bodyFormData)
        .then((result) => {
          const response = result as {
            data: { desktopVersion: string; dateUpdated: string };
          };
          const lv = response?.data['desktopVersion'];
          let lr = response?.data['dateUpdated'];
          if (!lr.endsWith('Z')) lr += 'Z';
          lr = DateTime.fromISO(lr)
            .setLocale(lang)
            .toLocaleString(DateTime.DATE_SHORT);
          setLatestVersion(lv);
          onLatestVersion(lv);
          setLatestRelease(lr);
          if (isElectron && lv?.split(' ')[0] !== version)
            showMessage(
              <span>
                {t.updateAvailable.replace('{0}', lv).replace('{1}', lr)}
                <IconButton
                  id="systemUpdate"
                  onClick={handleDownloadClick}
                  component="span"
                >
                  <SystemUpdateIcon color="primary" />
                </IconButton>
              </span>,
              AlertSeverity.Warning
            );
        })
        .catch((err) => {
          logError(
            Severity.error,
            errorReporter,
            infoMsg(err, 'userversions failed ' + navigator.userAgent)
          );
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updates, version, lang]);

  // A new screen gets a fresh chance to show the tip
  useEffect(() => {
    setUpdateTipOpen(pathname === '/');
  }, [pathname]);

  // Clicking anywhere on the screen closes the tip
  useEffect(() => {
    if (!updateTipOpen) return;
    document.addEventListener('pointerdown', closeUpdateTip);
    return () => document.removeEventListener('pointerdown', closeUpdateTip);
  }, [updateTipOpen]);

  return (
    <>
      {orbitStatus !== undefined || !connected ? (
        <IconButton onClick={() => handleSetOnline()}>
          <CloudOffIcon color="action" />
        </IconButton>
      ) : (
        isElectron &&
        !isOfflineOnly &&
        localStorage.getItem(LocalKey.userId) &&
        (plan || hasOfflineProjects) && (
          <Button
            onClick={handleCloud}
            startIcon={
              isOffline ? (
                <CloudOffIcon color="action" />
              ) : (
                <CloudOnIcon color="secondary" />
              )
            }
          >
            {isOffline ? t.goOnline : t.goOffline}
          </Button>
        )
      )}
      {latestVersion !== '' &&
        isElectron &&
        latestVersion?.split(' ')[0] !== version && (
          <Tooltip
            arrow
            placement="bottom-end"
            open={updateTipOpen}
            disableHoverListener
            disableFocusListener
            disableTouchListener
            title={t.updateAvailable
              .replace('{0}', latestVersion)
              .replace('{1}', latestRelease)}
          >
            <IconButton id="systemUpdate" onClick={handleDownloadClick}>
              <SystemUpdateIcon color="primary" />
            </IconButton>
          </Tooltip>
        )}
      {latestVersion !== '' &&
        !isElectron &&
        latestVersion.split(' ')[0] !== version &&
        latestVersion?.split(' ').length > 1 && (
          <Tooltip
            arrow
            open={updateTipOpen}
            disableHoverListener
            disableFocusListener
            disableTouchListener
            title={t.updateAvailable
              .replace('{0}', latestVersion)
              .replace('{1}', latestRelease)}
          >
            <IconButton
              id="systemUpdate"
              onClick={closeUpdateTip}
              href="https://www.audioprojectmanager.org"
            >
              <ExitToAppIcon color="primary" />
            </IconButton>
          </Tooltip>
        )}
    </>
  );
}
