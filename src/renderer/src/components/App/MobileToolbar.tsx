import { Toolbar, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { isElectron } from '../../../api-variable';
import HelpMenu from '../HelpMenu';
import UserMenu from '../UserMenu';
import { GrowingSpacer } from '../../control';
import { HeadStatus } from './HeadStatus';
import { OrgHead } from './OrgHead';
import { ApmLogo } from '../../control/ApmLogo';
import { type DownloadAlertReason } from './AppHead';
import MobileDetailTitle from './MobileDetailTitle';

export interface MobileToolbarProps {
  isDetail: boolean;
  planUrl: string | null;
  navigate: (path: string) => void;
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

export const MobileToolbar = ({
  isDetail,
  planUrl,
  navigate,
  isMobileWidth,
  handleMenu,
  setVersion,
  setLatestVersion,
  setUpdateTipOpen,
  isOffline,
  updateTipOpen,
  pathname,
  handleUserMenu,
}: MobileToolbarProps) => {
  return (
    <Toolbar>
      {!isDetail ? (
        <IconButton onClick={() => navigate('/team')} sx={{ p: 0 }}>
          <ApmLogo sx={{ width: '24px', height: '24px' }} />
        </IconButton>
      ) : (
        <IconButton onClick={() => navigate(planUrl || '/team')}>
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
  );
};
