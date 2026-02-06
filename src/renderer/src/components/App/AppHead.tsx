import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useGetGlobal, useGlobal } from '../../context/useGlobal';
import { useLocation, useParams } from 'react-router-dom';
import { IState, IViewModeStrings } from '../../model';
import { shallowEqual, useSelector } from 'react-redux';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  LinearProgress,
  Tooltip,
  Box,
} from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import TableViewIcon from '@mui/icons-material/TableView';
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
  exitApp,
  useMyNavigate,
  useWaitForRemoteQueue,
  useMobile,
} from '../../utils';
import { withBucket } from '../../hoc/withBucket';
import { usePlan } from '../../crud';
import Busy from '../Busy';
import ProjectDownloadAlert from '../ProjectDownloadAlert';
import { useSnackBar } from '../../hoc/SnackBar';
import PolicyDialog from '../PolicyDialog';
import JSONAPISource from '@orbit/jsonapi';
import { viewModeSelector } from '../../selector';
import { useHome } from '../../utils/useHome';
import { ApmLogo } from '../../control/ApmLogo';
import { OrgHead } from './OrgHead';
import { HeadStatus } from './HeadStatus';
import MobileDetailTitle from './MobileDetailTitle';

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

export type DownloadAlertReason = 'cloud';

export const AppHead = (props: IProps) => {
  const { resetRequests, switchTo } = props;
  const orbitStatus = useSelector((state: IState) => state.orbit.status);
  const orbitErrorMsg = useSelector((state: IState) => state.orbit.message);
  const { pathname } = useLocation();
  const navigate = useMyNavigate();
  const { isMobileView, isMobileWidth } = useMobile();
  const [home] = useGlobal('home'); //verified this is not used in a function 2/18/25
  const [orgRole] = useGlobal('orgRole'); //verified this is not used in a function 2/18/25
  const [errorReporter] = useGlobal('errorReporter');
  const [coordinator] = useGlobal('coordinator');
  const [user] = useGlobal('user');
  const [, setProject] = useGlobal('project');
  const [, setPlan] = useGlobal('plan'); //verified this is not used in a function 2/18/25
  const remote = coordinator?.getSource('remote') as JSONAPISource;
  const [isOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const tokenCtx = useContext(TokenContext);
  const tokenState = tokenCtx?.state ?? { expiresAt: null };
  const ctx = useContext(UnsavedContext);
  const { checkSavedFn, startSave, toolsChanged, anySaving } = ctx.state;
  const [cssVars, setCssVars] = useState<React.CSSProperties>(twoIcon);
  const [view, setView] = useState('');
  const [busy] = useGlobal('remoteBusy'); //verified this is not used in a function 2/18/25
  const [dataChangeCount] = useGlobal('dataChangeCount'); //verified this is not used in a function 2/18/25
  const [importexportBusy] = useGlobal('importexportBusy'); //verified this is not used in a function 2/18/25
  const [isChanged] = useGlobal('changed'); //verified this is only used in a useEffect
  const getGlobal = useGetGlobal();
  const [doExit, setDoExit] = useState(false);
  const [exitAlert, setExitAlert] = useState(false);
  const isMounted = useMounted('apphead');
  const [version, setVersion] = useState('');
  const [latestVersion, setLatestVersion] = useState('');
  const [complete] = useGlobal('progress'); //verified this is not used in a function 2/18/25
  const [downloadAlert, setDownloadAlert] = useState(false);
  const downloadAlertReason = useRef<DownloadAlertReason | null>(null);
  const [updateTipOpen, setUpdateTipOpen] = useState(false);
  const [showTerms, setShowTerms] = useState('');
  const waitForRemoteQueue = useWaitForRemoteQueue();
  const waitForDataChangesQueue = useWaitForRemoteQueue('datachanges');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const saving = useMemo(() => anySaving(), [toolsChanged]);
  const { showMessage } = useSnackBar();
  const tv: IViewModeStrings = useSelector(viewModeSelector, shallowEqual);

  const isDetail = useMemo(() => pathname.startsWith('/detail'), [pathname]);
  const planUrl = useMemo(() => {
    const fromUrl = localStorage.getItem(localUserKey(LocalKey.url));
    if (!fromUrl) return null;
    const m = /^\/(work|plan|detail)\/([0-9a-f-]+)\/?([0-9a-f-]*)/.exec(
      fromUrl
    );
    if (!m) return null;
    return `/plan/${m[2]}/0`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

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

  useEffect(() => {
    if (tokenState.expiresAt === -1) {
      handleMenu('Logout');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenState]);

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

  const handleTeamNav = () => {
    checkSavedFn(() => navigate('/team'));
  };

  const handlePlanNav = () => checkSavedFn(() => navigate(planUrl || '/team'));

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

  const handleTermsClose = () => setShowTerms('');

  if (view === 'Error') navigate('/error');
  if (view === 'Logout') setTimeout(() => navigate('/logout'), 500);
  if (view === 'Access') setTimeout(() => navigate('/'), 200);
  if (view === 'Terms') navigate('/terms');
  if (view === 'Privacy') navigate('/privacy');

  return !isMobileView && !isMobileWidth ? (
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
          <HeadStatus
            handleMenu={handleMenu}
            onVersion={setVersion}
            onLatestVersion={setLatestVersion}
            onUpdateTipOpen={setUpdateTipOpen}
          />
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
          {!isDetail ? (
            <IconButton onClick={handleTeamNav} sx={{ p: 0 }}>
              <ApmLogo sx={{ width: '24px', height: '24px' }} />
            </IconButton>
          ) : (
            <IconButton onClick={handlePlanNav}>
              <ArrowBackIcon sx={{ width: '24px', height: '24px' }} />
            </IconButton>
          )}
          {isDetail ? <MobileDetailTitle /> : <OrgHead />}
          <GrowingSpacer />
          {!isMobileWidth && (
            <HeadStatus
              handleMenu={handleMenu}
              onVersion={setVersion}
              onLatestVersion={setLatestVersion}
              onUpdateTipOpen={setUpdateTipOpen}
            />
          )}
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
