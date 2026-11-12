import { BoxProps, Box } from '@mui/material';
import { Button, ActionRow, rowSx } from '../control';

interface IAltActionBar extends BoxProps {
  primaryLabel: string;
  primaryOnClick: () => void;
  primaryDisabled?: boolean;
  primaryKey: string;
  primaryAria: string;
  altShown?: boolean;
  altLabel: string;
  altOnClick: () => void;
  altDisabled?: boolean;
  altKey: string;
  altAria: string;
}

export const AltActionBar = ({
  primaryLabel,
  primaryOnClick,
  primaryDisabled,
  primaryKey,
  primaryAria,
  altShown,
  altLabel,
  altOnClick,
  altKey,
  altAria,
  ...rest
}: IAltActionBar) => (
  <ActionRow
    sx={{
      textAlign: 'left',
      padding: '0px',
      backgroundColor: 'primary.contrastText',
      zIndex: '100',
      ...rest.sx,
    }}
  >
    <Box sx={rowSx}>
      <Button
        id="primaryAction"
        key={primaryKey}
        aria-label={primaryAria}
        sx={{ marginLeft: '0' }}
        color="primary"
        disabled={primaryDisabled || false}
        onClick={primaryOnClick}
      >
        {primaryLabel}
      </Button>
      {altShown && (
        <Button
          id="altAction"
          key={altKey}
          aria-label={altAria}
          sx={{ marginLeft: '8px' }}
          onClick={altOnClick}
        >
          {altLabel}
        </Button>
      )}
    </Box>
  </ActionRow>
);
