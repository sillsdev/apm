import { useContext } from 'react';
import { Toolbar, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { UnsavedContext } from '../../context/UnsavedContext';
import { GrowingSpacer } from '../../control';
import { ApmLogo } from '../../control/ApmLogo';
import { LocalKey } from '../../utils';
import { useHome } from '../../utils/useHome';
import HelpMenu from '../HelpMenu';
import UserMenu from '../UserMenu';
import DetailTitle from './DetailTitle';
import HeadStatus from './HeadStatus';
import { OrgHead } from './OrgHead';

interface AppToolbarProps {
  isDetail: boolean;
  planUrl: string | null;
  navigate: (path: string) => void;
  isMobile: boolean;
  isMobileWidth: boolean;
  handleMenu: (what: string, cloud?: boolean) => void;
  setVersion: (version: string) => void;
  setLatestVersion: (version: string) => void;
  isOffline: boolean;
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
  isOffline,
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

  // Clicking the logo or back button should check for any unsaved changes
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
        />
      )}
      <HelpMenu online={!isOffline} />
      {pathname !== '/' && !pathname.startsWith('/access') && (
        <UserMenu action={handleUserMenu} />
      )}
    </Toolbar>
  );
}
