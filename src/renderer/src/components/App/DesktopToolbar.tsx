import React, { useContext } from 'react';
import { useGlobal } from '../../context/useGlobal';
import { useParams } from 'react-router-dom';
import { IViewModeStrings, RoleNames } from '../../model';
import { shallowEqual, useSelector } from 'react-redux';
import { Toolbar, Typography, IconButton, Tooltip } from '@mui/material';
import HomeIcon from '@mui/icons-material/Home';
import TableViewIcon from '@mui/icons-material/TableView';
import { API_CONFIG, isElectron } from '../../../api-variable';
import { UnsavedContext } from '../../context/UnsavedContext';
import HelpMenu from '../HelpMenu';
import UserMenu from '../UserMenu';
import { GrowingSpacer } from '../../control';
import { LocalKey, useMyNavigate } from '../../utils';
import { usePlan } from '../../crud';
import { viewModeSelector } from '../../selector';
import { useHome } from '../../utils/useHome';
import { HeadStatus } from './HeadStatus';
import { type DownloadAlertReason } from './AppHead';

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

export interface DesktopToolbarProps {
  switchTo?: boolean;
  home: boolean;
  orgRole: RoleNames | undefined;
  cssVars: React.CSSProperties;
  pathname: string;
  handleMenu: (what: string, reason?: DownloadAlertReason | null) => void;
  setVersion: (version: string) => void;
  setLatestVersion: (version: string) => void;
  setUpdateTipOpen: (open: boolean) => void;
  isOffline: boolean;
  updateTipOpen: boolean;
  handleUserMenu: (what: string) => void;
  tv: IViewModeStrings;
}

export const DesktopToolbar = ({
  switchTo,
  home,
  orgRole,
  cssVars,
  pathname,
  handleMenu,
  setVersion,
  setLatestVersion,
  setUpdateTipOpen,
  isOffline,
  updateTipOpen,
  handleUserMenu,
  tv,
}: DesktopToolbarProps) => {
  return (
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
  );
};
