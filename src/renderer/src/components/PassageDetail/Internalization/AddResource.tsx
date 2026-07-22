import React, { useState } from 'react';
import { IPassageDetailArtifactsStrings } from '../../../model';
import { ListItemText, SxProps, Theme } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { AltButton, LightTooltip } from '../../../control';
import { resourceSelector } from '../../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { StyledMenu, StyledMenuItem } from '../../../control';
import { useGlobal } from '../../../context/useGlobal';
import { AddResourceAction } from './AddResourceAction';

interface IProps {
  action?: (what: AddResourceAction) => void;
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

  const handle = (what: AddResourceAction) => (event: React.MouseEvent) => {
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
        onClose={handle(AddResourceAction.Close)}
      >
        <StyledMenuItem
          id="audioResource"
          onClick={handle(AddResourceAction.Audio)}
        >
          <ListItemText>{t.addAudio}</ListItemText>
        </StyledMenuItem>
        <StyledMenuItem
          id="textResource"
          onClick={handle(AddResourceAction.Text)}
        >
          <ListItemText>{t.addText}</ListItemText>
        </StyledMenuItem>
        <StyledMenuItem
          id="urlResource"
          onClick={handle(AddResourceAction.Link)}
        >
          <ListItemText>{t.addUrl}</ListItemText>
        </StyledMenuItem>
        {!offline && !offlineOnly && (
          <StyledMenuItem
            id="linkedResource"
            onClick={handle(AddResourceAction.Shared)}
          >
            <ListItemText>
              {t.addLinked}
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
