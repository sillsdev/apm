import * as React from 'react';
import ButtonGroup from '@mui/material/ButtonGroup';
import SettingsIcon from '@mui/icons-material/Settings';
import { Button } from './Button';

export interface IConfButton {
  id?: string;
  disabled?: boolean;
  allowSettings?: boolean;
  /** When false, the settings (gear) segment is not rendered. Default true. */
  showSettings?: boolean;
  title?: string;
  onClick?: () => void;
  onSettings?: () => void;
}

export default function ConfButton({
  id,
  disabled,
  allowSettings = true,
  showSettings = true,
  onClick,
  onSettings,
  title,
  children,
}: IConfButton & React.PropsWithChildren) {
  const anchorRef = React.useRef<HTMLDivElement>(null);

  const handleClick = () => {
    if (onClick) {
      onClick();
    }
  };

  const handleSettings = () => {
    if (onSettings) {
      onSettings();
    }
  };

  return (
    <React.Fragment>
      <ButtonGroup
        variant="contained"
        color="inherit"
        ref={anchorRef}
        aria-label="Button group with a nested menu"
      >
        <Button onClick={handleClick} id={id} title={title} disabled={disabled}>
          {children}
        </Button>
        {showSettings && (
          <Button
            disableTypography
            size="small"
            onClick={handleSettings}
            disabled={disabled && !allowSettings}
          >
            <SettingsIcon
              fontSize="small"
              sx={{
                color:
                  disabled && !allowSettings ? 'grey[400]' : 'secondary.light',
                opacity: 0.7,
              }}
            />
          </Button>
        )}
      </ButtonGroup>
    </React.Fragment>
  );
}
