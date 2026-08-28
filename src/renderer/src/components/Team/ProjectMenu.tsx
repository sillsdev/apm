import React, { useEffect, useState } from 'react';
import { shallowEqual, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import { IconButton, ListItemIcon, ListItemText } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ExportIcon from '@mui/icons-material/CloudDownload';
import FilterIcon from '@mui/icons-material/FilterList';
import ImportIcon from '@mui/icons-material/CloudUpload';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CheckedIcon from '@mui/icons-material/RadioButtonChecked';
import UncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SettingsIcon from '@mui/icons-material/Settings';
// import ReportIcon from '@mui/icons-material/Assessment';
import { isElectron } from '../../../api-variable';
import { useGlobal } from '../../context/useGlobal';
import { StyledMenu, StyledMenuItem } from '../../control';
import ParatextLogo from '../../control/ParatextLogo';
import { useOfflnProjRead, ArtifactTypeSlug, useProjectType } from '../../crud';
import {
  ICardsStrings,
  IProjButtonsStrings,
  IToDoTableStrings,
  VProject,
} from '../../model';
import {
  cardsSelector,
  projButtonsSelector,
  toDoTableSelector,
} from '../../selector';
import { useMobile } from '../../utils';
import { addPt } from '../../utils/addPt';

interface IProps {
  inProject?: boolean;
  isAdmin: boolean;
  isPersonal?: boolean;
  project: string | VProject;
  justFilter?: boolean;
  action?: (what: string) => void;
  stopPlayer?: () => void;
  canPublish: boolean;
}

export default function ProjectMenu(props: IProps) {
  const {
    inProject,
    isAdmin,
    isPersonal,
    action,
    project,
    justFilter,
    stopPlayer,
  } = props;
  const [isOffline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here
  const [isDeveloper] = useGlobal('developer');
  const { pathname } = useLocation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const offlineProjectRead = useOfflnProjRead();
  const [projType, setProjType] = useState('');
  const t: ICardsStrings = useSelector(cardsSelector, shallowEqual);
  const { isMobile } = useMobile();
  const tpb: IProjButtonsStrings = useSelector(
    projButtonsSelector,
    shallowEqual
  );

  const { getProjType } = useProjectType();
  const td: IToDoTableStrings = useSelector(toDoTableSelector, shallowEqual);

  useEffect(() => {
    setProjType(getProjType(project));
  }, [project, getProjType]);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    if (stopPlayer) stopPlayer();
  };

  const handle = (what: string) => (e: React.MouseEvent) => {
    e.stopPropagation();
    setAnchorEl(null);
    if (action) {
      action(what);
    }
  };

  const offlineProject = offlineProjectRead(project);

  return (
    <>
      <IconButton
        id="projectMenu"
        aria-controls="customized-menu"
        aria-haspopup="true"
        onClick={handleClick}
        color="inherit"
        sx={{ p: 0.5 }}
      >
        <MoreVertIcon />
      </IconButton>
      <StyledMenu
        id="customized-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handle('Close')}
      >
        {!isMobile && !inProject && isAdmin && (!isOffline || offlineOnly) && (
          <StyledMenuItem id="projMenuSettings" onClick={handle('settings')}>
            <ListItemIcon>
              <SettingsIcon />
            </ListItemIcon>
            <ListItemText primary={t.settings} />
          </StyledMenuItem>
        )}
        {!isMobile && !inProject && isAdmin && !isOffline && (
          <StyledMenuItem id="projMenuCopy" onClick={handle('copyproject')}>
            <ListItemIcon>
              <ContentCopyIcon />
            </ListItemIcon>
            <ListItemText primary={t.copyProject} />
          </StyledMenuItem>
        )}
        {isElectron && !isOffline && !justFilter && isDeveloper && (
          <StyledMenuItem id="projMenuOl" onClick={handle('offlineAvail')}>
            <ListItemIcon>
              {offlineProject?.attributes?.offlineAvailable ? (
                <CheckedIcon />
              ) : (
                <UncheckedIcon />
              )}
            </ListItemIcon>
            <ListItemText primary={t.offlineAvail} />
          </StyledMenuItem>
        )}
        {/* {!justFilter && (
          <StyledMenuItem id="projMenuRep" onClick={handle('reports')}>
            <ListItemIcon>
              <ReportIcon />
            </ListItemIcon>
            <ListItemText primary={tpb.reports} />
          </StyledMenuItem>
        )} */}
        {!justFilter &&
          !isMobile &&
          pathname &&
          projType.toLowerCase() === 'scripture' &&
          pathname.indexOf(ArtifactTypeSlug.Retell) === -1 &&
          pathname.indexOf(ArtifactTypeSlug.QandA) === -1 && (
            <StyledMenuItem id="projMenuInt" onClick={handle('integration')}>
              <ListItemIcon>
                <ParatextLogo />
              </ListItemIcon>
              <ListItemText primary={addPt(tpb.integrations)} />
            </StyledMenuItem>
          )}
        {!isMobile && !inProject && (!isOffline || offlineOnly) && isAdmin && (
          <StyledMenuItem id="projMenuCat" onClick={handle('category')}>
            <ListItemIcon>
              <EditIcon />
            </ListItemIcon>
            <ListItemText
              primary={!isPersonal ? t.editCategory : t.editPersonalCategory}
            />
          </StyledMenuItem>
        )}
        {!isMobile && !justFilter && isAdmin && !inProject && (
          <StyledMenuItem id="projMenuImp" onClick={handle('import')}>
            <ListItemIcon>
              <ImportIcon />
            </ListItemIcon>
            <ListItemText primary={tpb.import} />
          </StyledMenuItem>
        )}
        {!justFilter && (
          <StyledMenuItem id="projMenuExp" onClick={handle('export')}>
            <ListItemIcon>
              <ExportIcon />
            </ListItemIcon>
            <ListItemText primary={tpb.export} />
          </StyledMenuItem>
        )}
        {inProject ? (
          <StyledMenuItem id="projMenuFilt" onClick={handle('filter')}>
            <ListItemIcon>
              <FilterIcon />
            </ListItemIcon>
            <ListItemText primary={td.filter} />
          </StyledMenuItem>
        ) : (
          (!isOffline || offlineOnly) &&
          isAdmin &&
          !isMobile && (
            <StyledMenuItem id="projMenuDel" onClick={handle('delete')}>
              <ListItemIcon>
                <DeleteIcon />
              </ListItemIcon>
              <ListItemText primary={t.delete} />
            </StyledMenuItem>
          )
        )}
      </StyledMenu>
    </>
  );
}
