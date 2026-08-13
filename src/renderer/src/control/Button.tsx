import { Button as MuiButton, ButtonProps, Typography } from '@mui/material';

export function Button({ children, ...rest }: ButtonProps) {
  return (
    <MuiButton {...rest}>
      <Typography noWrap variant="button">
        {children}
      </Typography>
    </MuiButton>
  );
}
