import { useEffect, useState } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudOnIcon from '@mui/icons-material/Cloud';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdateAlt';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { shallowEqual, useSelector } from 'react-redux';
import { IMainStrings, ISharedStrings, IState } from '../../model';
import { useGlobal, useGetGlobal } from '../../context/useGlobal';
import { isElectron } from '../../../api-variable';
import { LocalKey } from '../../utils/localUserKey';
import { markNeedItfSync } from '../../utils/needItfSync';
import { useCheckOnline } from '../../utils/useCheckOnline';
import { mainSelector, sharedSelector } from '../../selector';
import { useSnackBar } from '../../hoc/SnackBar';
import { useOrbitData } from '../../hoc/useOrbitData';
import { OfflineProject } from '../../model/offlineProject';
import { usePlan } from '../../crud/usePlan';
import { type DownloadAlertReason } from './AppHead';
import { useOfflnProjRead } from '../../crud/useOfflnProjRead';
import { useVProjectRead } from '../../crud/useVProjectRead';
import { useLoadProjectData } from '../../crud/useLoadProjectData';
import { useOfflineAvailToggle } from '../../crud/useOfflineAvailToggle';
import { useLocation } from 'react-router-dom';
import logError, { Severity } from '../../utils/logErrorService';
import { infoMsg } from '../../utils/infoMsg';
import { Button } from '../../control/Button';
import { formatReleaseDate, isNewerVersion } from '../../utils/appUpdate';
import { appVersion, openUpdateDownload } from './useUpdateCheck';

interface IProps {
  handleMenu: (what: string, reason: DownloadAlertReason | null) => void;
  onUpdateTipOpen: (open: boolean) => void;
}

export const HeadStatus = (props: IProps) => {
  const { handleMenu, onUpdateTipOpen } = props;
  const { pathname } = useLocation();
  const orbitStatus = useSelector((state: IState) => state.orbit.status);
  const [connected] = useGlobal('connected'); //verified this is not used in a function 2/18/25
  const getGlobal = useGetGlobal();
  const checkOnline = useCheckOnline('HeadStatus');
  const offlineProjects = useOrbitData<OfflineProject[]>('offlineproject');
  const [hasOfflineProjects, setHasOfflineProjects] = useState(false);
  const [isOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [isOfflineOnly] = useGlobal('offlineOnly'); //verified this is not used in a function 2/18/25
  const [errorReporter] = useGlobal('errorReporter');
  const lang = useSelector((state: IState) => state.strings.lang);
  const [plan] = useGlobal('plan'); //verified this is not used in a function 2/18/25
  const { getPlan } = usePlan();
  // Fetched by useUpdateCheck (AppHead); this component only shows the icon.
  const [latestVersion] = useGlobal('latestVersion'); //verified this is not used in a function 2/18/25
  const [releaseDate] = useGlobal('releaseDate'); //verified this is not used in a function 2/18/25
  const [updateTipOpen, setUpdateTipOpen] = useState(false);
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
    // Either leaving online (start of an offline session) or returning from
    // offline. Marking on the way back also covers sessions that began before
    // this flag existed.
    markNeedItfSync();
    localStorage.setItem(LocalKey.plan, getGlobal('plan'));
    handleMenu('Logout', !getGlobal('offline') ? 'cloud' : null);
  };

  const handleSetOnline = (cb?: () => void) => {
    // useCheckOnline clears stale orbit network error when AmIOnline succeeds
    // (TT-7720), including CloudOff → online while connected was already true.
    checkOnline((isConnected) => {
      if (!isConnected) {
        showMessage(ts.mustBeOnline);
        return;
      }
      cb && cb();
    }, true);
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

  const updateNewer = isNewerVersion(latestVersion, appVersion);
  const updateTitle = t.updateAvailable
    .replace('{0}', latestVersion)
    .replace('{1}', formatReleaseDate(releaseDate, lang));

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
            variant="outlined"
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
      {isElectron && updateNewer && (
        <Tooltip
          arrow
          placement="bottom-end"
          open={updateTipOpen}
          onOpen={handleUpdateOpen}
          onClose={handleUpdateClose}
          title={updateTitle}
        >
          <IconButton id="systemUpdate" onClick={openUpdateDownload}>
            <SystemUpdateIcon color="primary" />
          </IconButton>
        </Tooltip>
      )}
      {!isElectron &&
        updateNewer &&
        // Legacy server convention: a web notice is wanted only when the
        // version carries a suffix (e.g. "4.7.3 beta").
        latestVersion.trim().split(/\s+/).length > 1 && (
          <Tooltip
            arrow
            open={updateTipOpen}
            onOpen={handleUpdateOpen}
            onClose={handleUpdateClose}
            title={updateTitle}
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
