import React, { useState } from 'react';
import { IPassageDetailArtifactsStrings } from '../../../model';
import { ListItemText, SxProps, Theme } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { AltButton, LightTooltip } from '../../../control';
import { resourceSelector } from '../../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { StyledMenu, StyledMenuItem } from '../../../control';
import { useGlobal } from '../../../context/useGlobal';

interface IProps {
  action?: (what: string) => void;
  stopPlayer?: () => void;
  buttonDark?: boolean;
  buttonElevated?: boolean; // setting for some shadowing
  buttonSx?: SxProps<Theme>;
}

export const AddResource = (props: IProps) => {
  const { action, stopPlayer, buttonDark, buttonElevated, buttonSx } = props;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [offline] = useGlobal('offline'); //verified this is not used in a function 2/18/25
  const [offlineOnly] = useGlobal('offlineOnly'); //will be constant here

  const t: IPassageDetailArtifactsStrings = useSelector(
    resourceSelector,
    shallowEqual
  );
  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    if (stopPlayer) stopPlayer();
  };

  const handle = (what: string) => (event: React.MouseEvent) => {
    event.stopPropagation();
    setAnchorEl(null);
    if (action) {
      action(what);
    }
  };

  return (
    <div>
      <AltButton
        id="add-resource"
        onClick={handleClick}
        dark={buttonDark}
        elevated={buttonElevated}
        sx={buttonSx}
      >
        {t.add}
      </AltButton>
      <StyledMenu
        id="customized-menu"
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handle('Close')}
      >
        <StyledMenuItem id="uploadResource" onClick={handle('upload')}>
          <ListItemText>{t.upload}</ListItemText>
        </StyledMenuItem>
        <StyledMenuItem id="linkResource" onClick={handle('link')}>
          <ListItemText>{t.linkResource}</ListItemText>
        </StyledMenuItem>
        <StyledMenuItem id="recordResource" onClick={handle('record')}>
          <ListItemText>{t.recordResource}</ListItemText>
        </StyledMenuItem>
        <StyledMenuItem id="textResource" onClick={handle('text')}>
          <ListItemText>{t.textResource}</ListItemText>
        </StyledMenuItem>
        {!offline && !offlineOnly && (
          <StyledMenuItem id="sharedResource" onClick={handle('shared')}>
            <ListItemText>
              {t.sharedResource}
              {'\u00A0'}
              <LightTooltip title={t.tip1b}>
                <InfoIcon />
              </LightTooltip>
            </ListItemText>
          </StyledMenuItem>
        )}
      </StyledMenu>
    </div>
  );
};

export default AddResource;
