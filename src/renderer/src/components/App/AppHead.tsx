import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { shallowEqual, useSelector } from 'react-redux';
import { AppBar, LinearProgress, Box } from '@mui/material';
import JSONAPISource from '@orbit/jsonapi';
import { isElectron } from '../../../api-variable';
import { IState, IViewModeStrings } from '../../model';
import { useGetGlobal, useGlobal } from '../../context/useGlobal';
import { TokenContext } from '../../context/TokenProvider';
import { UnsavedContext } from '../../context/UnsavedContext';
import {
  resetData,
  exitElectronApp,
  forceLogin,
  localUserKey,
  LocalKey,
  useMounted,
  logError,
  Severity,
  relaunchApp,
  useMyNavigate,
  useWaitForRemoteQueue,
  useMobile,
  drainQueuesForLogout,
} from '../../utils';
import { withBucket } from '../../hoc/withBucket';
import { useSnackBar } from '../../hoc/SnackBar';
import { viewModeSelector } from '../../selector';
import Busy from '../Busy';
import ProjectDownloadAlert from '../ProjectDownloadAlert';
import PolicyDialog from '../PolicyDialog';
import { DesktopToolbar } from './DesktopToolbar';
import { MobileToolbar } from './MobileToolbar';

const twoIcon = { minWidth: `calc(${48 * 2}px)` } as React.CSSProperties;
const threeIcon = { minWidth: `calc(${48 * 3}px)` } as React.CSSProperties;

type ResetRequests = () => Promise<void>;
export type DownloadAlertReason = 'cloud';

export interface AppHeadProps {
  resetRequests?: ResetRequests;
  switchTo?: boolean;
  drawBottomBorder?: boolean;
  position?: 'fixed' | 'sticky' | 'static';
}

export function AppHead({
  resetRequests,
  switchTo,
  drawBottomBorder = true,
  position = 'fixed',
}: AppHeadProps) {
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
  const tokenState = tokenCtx?.state ?? {
    expiresAt: null,
    authSessionCleared: false,
  };
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
        drainQueuesForLogout(
          waitForRemoteQueue,
          waitForDataChangesQueue,
          coordinator,
          'logout on electron'
        ).then(() => {
          if (getGlobal('offline')) downDone();
          else if (downloadAlertReason.current === 'cloud' && !isOffline)
            setDownloadAlert(true);
          else downDone();
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
          drainQueuesForLogout(
            waitForRemoteQueue,
            waitForDataChangesQueue,
            coordinator,
            'logout on web'
          ).then(() => setView('Logout'));
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
    // expiresAt is legitimately -1 while genuinely offline (no online token
    // to expire) — this used to fire Logout unconditionally, which re-ran
    // the whole "Go Offline" teardown/relaunch flow every time AppHead
    // mounted offline, looping the app through logout -> relaunch forever.
    // Loading.tsx's equivalent check already guards with !offline; mirror it.
    if (
      !getGlobal('offline') &&
      tokenState.expiresAt === -1 &&
      !tokenState.authSessionCleared
    ) {
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
    // This used to call exitApp(), which just quits with nothing to bring
    // the app back — the user is left staring at a closed app after
    // confirming "Go Offline". relaunchApp() quits and restarts, so it
    // reopens straight into the newly-offline session.
    if (localStorage.getItem(LocalKey.userId)) relaunchApp();
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

  const isMobile = isMobileView || isMobileWidth;

  return (
    <AppBar
      position={position}
      sx={{
        width: '100%',
        display: 'flex',
        px: 1.5,
        backgroundColor: 'custom.headerBackground',
        ...(drawBottomBorder && {
          borderBottom: '1px solid',
          borderColor: 'divider',
        }),
      }}
      color="inherit"
    >
      <>
        {complete === 0 || complete === 100 || (
          <Box sx={{ mx: -1.5 }}>
            <LinearProgress id="prog" variant="determinate" value={complete} />
          </Box>
        )}
        {(!busy && !saving && !dataChangeCount) || complete !== 0 || (
          <LinearProgress id="busy" variant="indeterminate" sx={{ mx: -1.5 }} />
        )}

        {isMobile ? (
          <MobileToolbar
            isDetail={isDetail}
            planUrl={planUrl}
            navigate={navigate}
            isMobileWidth={isMobileWidth}
            handleMenu={handleMenu}
            setVersion={setVersion}
            setLatestVersion={setLatestVersion}
            setUpdateTipOpen={setUpdateTipOpen}
            isOffline={isOffline}
            updateTipOpen={updateTipOpen}
            pathname={pathname}
            handleUserMenu={handleUserMenu}
          />
        ) : (
          <DesktopToolbar
            switchTo={switchTo}
            home={home}
            orgRole={orgRole}
            cssVars={cssVars}
            pathname={pathname}
            handleMenu={handleMenu}
            setVersion={setVersion}
            setLatestVersion={setLatestVersion}
            setUpdateTipOpen={setUpdateTipOpen}
            isOffline={isOffline}
            updateTipOpen={updateTipOpen}
            handleUserMenu={handleUserMenu}
            tv={tv}
          />
        )}
        {importexportBusy && !downloadAlert && <Busy />}
        {downloadAlert && <ProjectDownloadAlert cb={downDone} />}
        <PolicyDialog
          isOpen={Boolean(showTerms)}
          content={showTerms}
          onClose={handleTermsClose}
        />
      </>
    </AppBar>
  );
}

const AppHeadWithBucket = withBucket(AppHead);
AppHeadWithBucket.displayName = 'AppHead';
export default AppHeadWithBucket;
