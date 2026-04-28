import { Button, ButtonProps } from '@mui/material';

interface IAltButtonProps extends ButtonProps {
  dark?: boolean;
  elevated?: boolean;
}

export const AltButton = ({
  children,
  dark,
  elevated,
  sx,
  ...rest
}: IAltButtonProps) => (
  <Button
    variant="outlined"
    color="primary"
    sx={{
      m: 1,
      overflow: 'hidden',
      whiteSpace: 'nowrap',
      justifyContent: 'flex-start',
      ...(dark
        ? {
            color: 'common.black',
            borderColor: 'common.black',
            '&:hover': {
              borderColor: 'common.black',
              backgroundColor: 'rgba(0,0,0,0.04)',
            },
          }
        : {}),
      ...(elevated
        ? {
            boxShadow: '0 1px 3px rgba(0,0,0,0.22)',
          }
        : {}),
      ...sx,
    }}
    {...rest}
  >
    {children}
  </Button>
);
