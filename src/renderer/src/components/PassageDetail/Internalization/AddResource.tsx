import React, { useState } from 'react';
import { IPassageDetailArtifactsStrings } from '../../../model';
import { ListItemText } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import { Button, LightTooltip } from '../../../control';
import { resourceSelector } from '../../../selector';
import { shallowEqual, useSelector } from 'react-redux';
import { StyledMenu, StyledMenuItem } from '../../../control';
import { useGlobal } from '../../../context/useGlobal';

interface IProps {
  action?: (what: string) => void;
}

export const AddResource = (props: IProps) => {
  const { action } = props;
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
  };

  const handle = (what: string) => (event: React.MouseEvent) => {
    event.stopPropagation();
    setAnchorEl(null);
    if (action) {
      action(what);
    }
  };

  return (
    <>
      <Button id="add-resource" onClick={handleClick}>
        {t.add}
      </Button>
      <StyledMenu
        id="customized-menu"
        anchorEl={anchorEl}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handle('Close')}
      >
        <StyledMenuItem id="audioResource" onClick={handle('audio')}>
          <ListItemText>{t.addAudio}</ListItemText>
        </StyledMenuItem>
        <StyledMenuItem id="textResource" onClick={handle('text')}>
          <ListItemText>{t.addText}</ListItemText>
        </StyledMenuItem>
        <StyledMenuItem id="urlResource" onClick={handle('link')}>
          <ListItemText>{t.addUrl}</ListItemText>
        </StyledMenuItem>
        {!offline && !offlineOnly && (
          <StyledMenuItem id="linkedResource" onClick={handle('shared')}>
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
    </>
  );
};

export default AddResource;
