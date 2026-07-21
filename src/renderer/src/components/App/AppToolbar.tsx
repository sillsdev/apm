import { useContext } from 'react';
import { Toolbar, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { isElectron } from '../../../api-variable';
import { UnsavedContext } from '../../context/UnsavedContext';
import HelpMenu from '../HelpMenu';
import UserMenu from '../UserMenu';
import { GrowingSpacer } from '../../control';
import { LocalKey } from '../../utils';
import { useHome } from '../../utils/useHome';
import { HeadStatus } from './HeadStatus';
import { OrgHead } from './OrgHead';
import { ApmLogo } from '../../control/ApmLogo';
import { type DownloadAlertReason } from './AppHead';
import DetailTitle from './DetailTitle';

interface AppToolbarProps {
  isDetail: boolean;
  planUrl: string | null;
  navigate: (path: string) => void;
  isMobile: boolean;
  isMobileWidth: boolean;
  handleMenu: (what: string, reason?: DownloadAlertReason | null) => void;
  setVersion: (version: string) => void;
  setLatestVersion: (version: string) => void;
  setUpdateTipOpen: (open: boolean) => void;
  isOffline: boolean;
  updateTipOpen: boolean;
  pathname: string;
  handleUserMenu: (what: string) => void;
}

export default function AppToolbar({
  isDetail,
  planUrl,
  navigate,
  isMobile,
  isMobileWidth,
  handleMenu,
  setVersion,
  setLatestVersion,
  setUpdateTipOpen,
  isOffline,
  updateTipOpen,
  pathname,
  handleUserMenu,
}: AppToolbarProps) {
  const ctx = useContext(UnsavedContext);
  const { checkSavedFn } = ctx.state;
  const { goHome } = useHome();

  const handleHome = () => {
    // On mobile, clicking the logo should navigate to the team screen
    if (isMobile) {
      navigate('/team');
      return;
    }
    // On desktop, clicking the logo should clear the current project selection
    localStorage.removeItem(LocalKey.plan);
    localStorage.removeItem('mode');
    goHome();
  };

  const handleBack = () => navigate(planUrl || '/team');

  // On desktop, clicking the logo or back button should check for any unsaved changes
  const checkSavedAndGoHome = () => checkSavedFn(() => handleHome());
  const checkSavedAndGoBack = () => checkSavedFn(() => handleBack());

  return (
    <Toolbar disableGutters>
      {!isDetail ? (
        <IconButton onClick={checkSavedAndGoHome} sx={{ p: 0 }}>
          <ApmLogo sx={{ width: '40px', height: '40px' }} />
        </IconButton>
      ) : (
        <IconButton onClick={checkSavedAndGoBack}>
          <ArrowBackIcon sx={{ width: '24px', height: '24px' }} />
        </IconButton>
      )}
      {isDetail ? <DetailTitle /> : <OrgHead />}
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
        <UserMenu action={handleUserMenu} />
      )}
    </Toolbar>
  );
}
