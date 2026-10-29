import * as React from 'react';
import { Button } from './Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import SettingsIcon from '@mui/icons-material/Settings';

export interface IConfButton {
  id?: string;
  disabled?: boolean;
  /**
   * When true, the settings (gear) segment stays enabled while the main button
   * is disabled. Default false: settings that start the action (e.g. Run in
   * the ASR dialog) must not bypass what disabled the main button.
   */
  allowSettings?: boolean;
  /** When false, the settings (gear) segment is not rendered. Default true. */
  showSettings?: boolean;
  title?: string;
  /** Accessible name for the icon-only settings segment. */
  settingsLabel?: string;
  onClick?: () => void;
  onSettings?: () => void;
}

export default function ConfButton({
  id,
  disabled,
  allowSettings = false,
  showSettings = true,
  onClick,
  onSettings,
  title,
  settingsLabel,
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
      {/* The theme gives each button size a fixed height; sizing the group
          keeps the gear and the main button the same height. */}
      <ButtonGroup
        variant="contained"
        color="inherit"
        size="small"
        ref={anchorRef}
      >
        {showSettings && (
          <Button
            disableTypography
            sx={{ minWidth: 0 }}
            onClick={handleSettings}
            aria-label={settingsLabel}
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
        {/* No Typography wrapper: an icon inside it sits on the text baseline,
            above centre. The button's own flex layout centres icon and text. */}
        <Button
          disableTypography
          sx={{ whiteSpace: 'nowrap' }}
          onClick={handleClick}
          id={id}
          title={title}
          disabled={disabled}
        >
          {children}
        </Button>
      </ButtonGroup>
    </React.Fragment>
  );
}
