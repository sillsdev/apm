import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useGetGlobal, useGlobal } from '../../context/useGlobal';
import { useLocation, useParams } from 'react-router-dom';
import {
  IState,
  IMainStrings,
  IViewModeStrings,
  ISharedStrings,
  OfflineProject,
} from '../../model';
import { shallowEqual, useSelector } from 'react-redux';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  LinearProgress,
  Tooltip,
  Box,
  Button,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdateAlt';
import TableViewIcon from '@mui/icons-material/TableView';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import { API_CONFIG, isElectron } from '../../../api-variable';
import { TokenContext } from '../../context/TokenProvider';
import { UnsavedContext } from '../../context/UnsavedContext';
import HelpMenu from '../HelpMenu';
import UserMenu from '../UserMenu';
import { GrowingSpacer } from '../../control';
import {
  resetData,
  exitElectronApp,
  forceLogin,
  localUserKey,
  LocalKey,
  useMounted,
  logError,
  Severity,
  infoMsg,
  exitApp,
  useMyNavigate,
  useWaitForRemoteQueue,
  Online,
} from '../../utils';
import { withBucket } from '../../hoc/withBucket';
import {
  useLoadProjectData,
  useOfflineAvailToggle,
  useOfflnProjRead,
  usePlan,
  useVProjectRead,
} from '../../crud';
import Busy from '../Busy';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import CloudOnIcon from '@mui/icons-material/Cloud';
import ProjectDownloadAlert from '../ProjectDownloadAlert';
import { axiosPost } from '../../utils/axios';
import { DateTime } from 'luxon';
import { useSnackBar, AlertSeverity } from '../../hoc/SnackBar';
import PolicyDialog from '../PolicyDialog';
import JSONAPISource from '@orbit/jsonapi';
import { mainSelector, sharedSelector, viewModeSelector } from '../../selector';
import { useHome } from '../../utils/useHome';
import { useOrbitData } from '../../hoc/useOrbitData';
import packageJson from '../../../package.json';
import { MainAPI } from '@model/main-api';
import { ApmLogo } from '../../control/ApmLogo';
import { OrgHead } from './OrgHead';
const ipc = window?.api as MainAPI;

const twoIcon = { minWidth: `calc(${48 * 2}px)` } as React.CSSProperties;
const threeIcon = { minWidth: `calc(${48 * 3}px)` } as React.CSSProperties;

interface INameProps {
  switchTo: boolean;
}

const ProjectName = ({ switchTo }: INameProps) => {
  const ctx = useContext(UnsavedContext);
  const { checkSavedFn } = ctx.state;
  const { getPlanName } = usePlan();
  const [plan] = useGlobal('plan'); //verified this is not used in a function 2/18/25
  const { prjId } = useParams();
  const navigate = useMyNavigate();
  const { goHome } = useHome();
  const t: IViewModeStrings = useSelector(viewModeSelector, shallowEqual);

  const handleHome = () => {
    localStorage.removeItem(LocalKey.plan);
    localStorage.removeItem('mode');
    goHome();
  };

  const handleAudioProject = () => {
    navigate(`/plan/${prjId}/0`);
  };

  const checkSavedAndGoAP = () => checkSavedFn(() => handleAudioProject());
  const checkSavedAndGoHome = () => checkSavedFn(() => handleHome());

  return (
    <>
      <Tooltip title={t.home}>
        <IconButton id="home" onClick={checkSavedAndGoHome}>
          <HomeIcon />
        </IconButton>
      </Tooltip>
      {plan && switchTo && (
        <Tooltip title={t.audioProject}>
          <IconButton id="project" onClick={checkSavedAndGoAP}>
            <TableViewIcon />
          </IconButton>
        </Tooltip>
      )}
      <Typography variant="h6" noWrap>
        {getPlanName(plan)}
      </Typography>
    </>
  );
};

type ResetRequests = () => Promise<void>;

interface IProps {
  resetRequests?: ResetRequests;
  switchTo?: boolean;
}

type DownloadAlertReason = 'cloud';

export const AppHead = (props: IProps) => {
  const { resetRequests, switchTo } = props;
  const orbitStatus = useSelector((state: IState) => state.orbit.status);
  const orbitErrorMsg = useSelector((state: IState) => state.orbit.message);
  const t: IMainStrings = useSelector(mainSelector, shallowEqual);
  const ts: ISharedStrings = useSelector(sharedSelector, shallowEqual);
  const { pathname } = useLocation();
  const navigate = useMyNavigate();
  const offlineProjects = useOrbitData<OfflineProject[]>('offlineproject');
  const [hasOfflineProjects, setHasOfflineProjects] = useState(false);
  const [home] = useGlobal('home'); //verified this is not used in a function 2/18/25
  const [orgRole] = useGlobal('orgRole'); //verified this is not used in a function 2/18/25
  const [connected, setConnected] = useGlobal('connected'); //verified this is not used in a function 2/18/25
  const [errorReporter] = useGlobal('errorReporter');
  const [coordinator] = useGlobal('coordinator');
  const [user] = useGlobal('user');
  const [, setProject] = useGlobal('project');
  const [plan, setPlan] = useGlobal('plan'); //verified this is not used in a function 2/18/25
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const [isOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [isOfflineOnly] = useGlobal('offlineOnly'); //verified this is not used in a function 2/18/25
  const tokenCtx = useContext(TokenContext);
  const ctx = useContext(UnsavedContext);
  const { checkSavedFn, startSave, toolsChanged, anySaving } = ctx.state;
  const [cssVars, setCssVars] = useState<React.CSSProperties>(twoIcon);
  const [view, setView] = useState('');
  const [busy] = useGlobal('remoteBusy'); //verified this is not used in a function 2/18/25
  const [dataChangeCount] = useGlobal('dataChangeCount'); //verified this is not used in a function 2/18/25
  const [importexportBusy] = useGlobal('importexportBusy'); //verified this is not used in a function 2/18/25
  const [isChanged] = useGlobal('changed'); //verified this is only used in a useEffect
  const [lang] = useGlobal('lang');
  const getGlobal = useGetGlobal();
  const [doExit, setDoExit] = useState(false);
  const [exitAlert, setExitAlert] = useState(false);
  const isMounted = useMounted('apphead');
  const [version, setVersion] = useState('');
  const [updates] = useState(
    (localStorage.getItem('updates') || 'true') === 'true'
  );
  const [latestVersion, setLatestVersion] = useGlobal('latestVersion'); //verified this is not used in a function 2/18/25
  const [latestRelease, setLatestRelease] = useGlobal('releaseDate'); //verified this is not used in a function 2/18/25
  const [complete] = useGlobal('progress'); //verified this is not used in a function 2/18/25
  const [downloadAlert, setDownloadAlert] = useState(false);
  const downloadAlertReason = useRef<DownloadAlertReason | null>(null);
  const [updateTipOpen, setUpdateTipOpen] = useState(false);
  const [showTerms, setShowTerms] = useState('');
  const waitForRemoteQueue = useWaitForRemoteQueue();
  const waitForDataChangesQueue = useWaitForRemoteQueue('datachanges');
  const offlineProjectRead = useOfflnProjRead();
  const LoadData = useLoadProjectData();
  const offlineAvailToggle = useOfflineAvailToggle();
  const { getPlan } = usePlan();
  const vProject = useVProjectRead();
  const [mobileView] = useGlobal('mobileView');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saving = useMemo(() => anySaving(), [toolsChanged]);
  const { showMessage } = useSnackBar();
  const tv: IViewModeStrings = useSelector(viewModeSelector, shallowEqual);

  const handleUserMenuAction = (
    what: string,
    lastpath: string,
    setView: (v: string) => void,
    resetRequests: () => Promise<void>
  ) => {
    if (/terms|privacy/i.test(what)) {
      setShowTerms(what);
      return;
    }
    if (isElectron && /ClearLogout/i.test(what)) {
      resetData();
      exitElectronApp();
    }

    if (isElectron && /Logout/i.test(what)) {
      localStorage.removeItem(LocalKey.userId);
      checkSavedFn(() => {
        waitForRemoteQueue('logout on electron...').then(() => {
          waitForDataChangesQueue('logout on electron').then(() => {
            if (getGlobal('offline')) downDone();
            else if (downloadAlertReason.current === 'cloud' && !isOffline)
              setDownloadAlert(true);
            else downDone();
          });
        });
      });
      return;
    }
    if (!lastpath.endsWith('null')) {
      localStorage.setItem(localUserKey(LocalKey.url), lastpath);
    }
    if (!/Close/i.test(what)) {
      if (/ClearLogout/i.test(what)) {
        forceLogin();
        setView('Logout');
      } else if (/Clear/i.test(what)) {
        if (resetRequests) resetRequests().then(() => setView(what));
      } else if (/Logout/i.test(what)) {
        checkSavedFn(() => {
          waitForRemoteQueue('logout on web...').then(() =>
            waitForDataChangesQueue('logout on electron').then(() =>
              setView('Logout')
            )
          );
        });
      } else checkSavedFn(() => setView(what));
    }
  };

  const handleMenu = (
    what: string,
    reason: DownloadAlertReason | null = null
  ) => {
    downloadAlertReason.current = reason;
    if (/\/team/i.test(pathname)) {
      setProject('');
      setPlan('');
    }
    handleUserMenuAction(
      what,
      pathname,
      setView,
      resetRequests as ResetRequests
    );
  };

  const handleUserMenu = (what: string) => {
    localStorage.removeItem('mode');
    localStorage.removeItem(LocalKey.plan);
    handleMenu(what);
  };

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
    handleMenu('Logout', !isOffline ? 'cloud' : null);
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

  useEffect(() => {
    if (tokenCtx.state.expiresAt === -1) {
      handleMenu('Logout');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenCtx.state]);

  const doingDone = useRef(false);

  const downDone = (cancel?: boolean) => {
    if (doingDone.current) return;
    doingDone.current = true;
    setDownloadAlert(false);
    downloadAlertReason.current = null;
    if (cancel && !doExit) {
      const userId = localStorage.getItem(LocalKey.onlineUserId);
      if (userId) localStorage.setItem(LocalKey.userId, userId);
      return;
    }
    if (localStorage.getItem(LocalKey.userId)) exitApp();
    else setView('Logout');
  };

  const handleDownloadClick = () => {
    if (ipc)
      ipc?.openExternal(
        'https://software.sil.org/audioprojectmanager/download/'
      );
    // remote?.getCurrentWindow().close();
  };

  const handleUnload = (e: any) => {
    if (pathname === '/') return true;
    if (pathname.startsWith('/access')) return true;
    if (!exitAlert && isElectron && isMounted() && !doingDone.current) {
      setDoExit(true);
      setExitAlert(true);
    }
    const queueLength = remote?.requestQueue.length ?? 0;
    const busy = queueLength > 0 || getGlobal('remoteBusy');
    if ((getGlobal('changed') || busy) && !getGlobal('enableOffsite')) {
      e.preventDefault();
      e.returnValue = '';
      return true;
    }
    if (localStorage.getItem(localUserKey(LocalKey.url)) === '/team') {
      localStorage.setItem(localUserKey(LocalKey.url), '/');
    }
    return undefined;
  };

  useEffect(() => {
    window.addEventListener('beforeunload', handleUnload);
    if (!user) {
      //are we here from a deeplink?
      if (
        pathname !== '/' &&
        !pathname.startsWith('/access') &&
        pathname !== '/loading'
      ) {
        setView('Access');
      }
    }
    setHasOfflineProjects(
      offlineProjects.some((p) => p?.attributes?.offlineAvailable)
    );
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
    };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, []);

  useEffect(() => {
    if (exitAlert)
      if (!isChanged) {
        if (isMounted()) {
          if (downloadAlertReason.current === 'cloud' && !isOffline)
            setDownloadAlert(true);
          else downDone();
        }
      } else startSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exitAlert, isChanged]);

  useEffect(() => {
    isMounted() && setVersion(packageJson.version);
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
    setCssVars(
      latestVersion !== '' && latestVersion !== version && isElectron
        ? threeIcon
        : twoIcon
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, latestVersion]);

  useEffect(() => {
    logError(Severity.info, errorReporter, pathname);
    setUpdateTipOpen(pathname === '/');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (orbitStatus) {
      showMessage(orbitErrorMsg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbitStatus, orbitErrorMsg]);

  const handleUpdateOpen = () => setUpdateTipOpen(true);
  const handleUpdateClose = () => setUpdateTipOpen(pathname === '/');
  const handleTermsClose = () => setShowTerms('');

  if (view === 'Error') navigate('/error');
  if (view === 'Logout') setTimeout(() => navigate('/logout'), 500);
  if (view === 'Access') setTimeout(() => navigate('/'), 200);
  if (view === 'Terms') navigate('/terms');
  if (view === 'Privacy') navigate('/privacy');
  return !mobileView ? (
    <AppBar
      position="fixed"
      sx={{ width: '100%', display: 'flex' }}
      color="inherit"
    >
      <>
        {complete === 0 || complete === 100 || (
          <Box sx={{ width: '100%' }}>
            <LinearProgress id="prog" variant="determinate" value={complete} />
          </Box>
        )}
        {(!busy && !saving && !dataChangeCount) || complete !== 0 || (
          <LinearProgress id="busy" variant="indeterminate" />
        )}
        <Toolbar>
          {!home && orgRole && (
            <>
              <ProjectName switchTo={switchTo ?? false} />
              <GrowingSpacer />
              <Typography variant="h6">
                {switchTo ? tv.work : tv.audioProject}
              </Typography>
              <GrowingSpacer />
            </>
          )}
          {home && <span style={cssVars}>{'\u00A0'}</span>}
          <GrowingSpacer />
          {(pathname === '/' || pathname.startsWith('/access')) && (
            <>
              <Typography variant="h6" noWrap>
                {API_CONFIG.productName}
              </Typography>
              <GrowingSpacer />
            </>
          )}
          {'\u00A0'}
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
          <HelpMenu
            online={!isOffline}
            sx={updateTipOpen && isElectron ? { top: '40px' } : {}}
          />
          {pathname !== '/' && !pathname.startsWith('/access') && (
            <UserMenu action={handleUserMenu} />
          )}
        </Toolbar>
        {!importexportBusy || <Busy />}
        {downloadAlert && <ProjectDownloadAlert cb={downDone} />}
        <PolicyDialog
          isOpen={Boolean(showTerms)}
          content={showTerms}
          onClose={handleTermsClose}
        />
      </>
    </AppBar>
  ) : (
    <AppBar
      position="fixed"
      sx={{ width: '100%', display: 'flex' }}
      color="inherit"
    >
      <>
        <Toolbar>
          <IconButton onClick={() => navigate('/team')}>
            <ApmLogo sx={{ width: '24px', height: '24px' }} />
          </IconButton>
          <OrgHead />
          <GrowingSpacer />
          <HelpMenu
            online={!isOffline}
            sx={updateTipOpen && isElectron ? { top: '40px' } : {}}
          />
          {pathname !== '/' && !pathname.startsWith('/access') && (
            <UserMenu action={handleUserMenu} small={true} />
          )}
        </Toolbar>
        {complete === 0 || complete === 100 || (
          <Box sx={{ width: '100%' }}>
            <LinearProgress id="prog" variant="determinate" value={complete} />
          </Box>
        )}
        {(!busy && !saving && !dataChangeCount) || complete !== 0 || (
          <LinearProgress id="busy" variant="indeterminate" />
        )}
        {!importexportBusy || <Busy />}
        <PolicyDialog
          isOpen={Boolean(showTerms)}
          content={showTerms}
          onClose={handleTermsClose}
        />
      </>
    </AppBar>
  );
};

const AppHeadWithBucket = withBucket(AppHead);
AppHeadWithBucket.displayName = 'AppHead';
export default AppHeadWithBucket;
