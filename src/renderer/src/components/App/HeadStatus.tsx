import { useEffect, useState } from 'react';
import { Button, IconButton, Tooltip } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudOnIcon from '@mui/icons-material/Cloud';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdateAlt';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { shallowEqual, useSelector } from 'react-redux';
import { DateTime } from 'luxon';
import { IMainStrings, ISharedStrings, IState } from '../../model';
import { useGlobal, useGetGlobal } from '../../context/useGlobal';
import { isElectron } from '../../../api-variable';
import { LocalKey } from '../../utils/localUserKey';
import { Online } from '../../utils/useCheckOnline';
import { mainSelector, sharedSelector } from '../../selector';
import { AlertSeverity, useSnackBar } from '../../hoc/SnackBar';
import { useOrbitData } from '../../hoc/useOrbitData';
import { OfflineProject } from '../../model/offlineProject';
import { usePlan } from '../../crud/usePlan';
import { type DownloadAlertReason } from './AppHead';
import { useOfflnProjRead } from '../../crud/useOfflnProjRead';
import { useVProjectRead } from '../../crud/useVProjectRead';
import { useLoadProjectData } from '../../crud/useLoadProjectData';
import { useOfflineAvailToggle } from '../../crud/useOfflineAvailToggle';
import { useLocation } from 'react-router-dom';
import { axiosPost } from '../../utils/axios';
import packageJson from '../../../package.json';
import { useMounted } from '../../utils/useMounted';
import logError, { Severity } from '../../utils/logErrorService';
import { infoMsg } from '../../utils/infoMsg';
import { MainAPI } from '@model/main-api';
const ipc = window?.api as MainAPI;

interface IProps {
  handleMenu: (what: string, reason: DownloadAlertReason | null) => void;
  onVersion: (version: string) => void;
  onLatestVersion: (version: string) => void;
  onUpdateTipOpen: (open: boolean) => void;
}

export const HeadStatus = (props: IProps) => {
  const { handleMenu, onVersion, onLatestVersion, onUpdateTipOpen } = props;
  const { pathname } = useLocation();
  const orbitStatus = useSelector((state: IState) => state.orbit.status);
  const [connected, setConnected] = useGlobal('connected'); //verified this is not used in a function 2/18/25
  const getGlobal = useGetGlobal();
  const offlineProjects = useOrbitData<OfflineProject[]>('offlineproject');
  const [hasOfflineProjects, setHasOfflineProjects] = useState(false);
  const [isOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [isOfflineOnly] = useGlobal('offlineOnly'); //verified this is not used in a function 2/18/25
  const [errorReporter] = useGlobal('errorReporter');
  const [lang] = useGlobal('lang');
  const [plan] = useGlobal('plan'); //verified this is not used in a function 2/18/25
  const { getPlan } = usePlan();
  const [version, setVersion] = useState('');
  const [updates] = useState(
    (localStorage.getItem('updates') || 'true') === 'true'
  );
  const [latestVersion, setLatestVersion] = useGlobal('latestVersion'); //verified this is not used in a function 2/18/25
  const [latestRelease, setLatestRelease] = useGlobal('releaseDate'); //verified this is not used in a function 2/18/25
  const [updateTipOpen, setUpdateTipOpen] = useState(false);
  const isMounted = useMounted('headstatus');
  const offlineProjectRead = useOfflnProjRead();
  const vProject = useVProjectRead();
  const LoadData = useLoadProjectData();
  const offlineAvailToggle = useOfflineAvailToggle();
  const { showMessage } = useSnackBar();
  const t: IMainStrings = useSelector(mainSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);

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
    handleMenu('Logout', !getGlobal('offline') ? 'cloud' : null);
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

  useEffect(() => {
    const value = offlineProjects.some((p) => p?.attributes?.offlineAvailable);
    if (value !== hasOfflineProjects) setHasOfflineProjects(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offlineProjects]);

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
          offlineAvailToggle(getGlobal('project')).then(() => {
            cloudAction();
          });
        });
      }
    });
  };

  const handleDownloadClick = () => {
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

  useEffect(() => {
    setUpdateTipOpen(pathname === '/');
  }, [pathname]);

  const handleUpdateOpen = () => {
    setUpdateTipOpen(true);
    onUpdateTipOpen(true);
  };
  const handleUpdateClose = () => {
    const isOpen = pathname === '/';
    setUpdateTipOpen(isOpen);
    onUpdateTipOpen(isOpen);
  };

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
            onOpen={handleUpdateOpen}
            onClose={handleUpdateClose}
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
            onOpen={handleUpdateOpen}
            onClose={handleUpdateClose}
            title={t.updateAvailable
              .replace('{0}', latestVersion)
              .replace('{1}', latestRelease)}
          >
            <IconButton
              id="systemUpdate"
              href="https://www.audioprojectmanager.org"
            >
              <ExitToAppIcon color="primary" />
            </IconButton>
          </Tooltip>
        )}
    </>
  );
};
