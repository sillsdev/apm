import { Box, BoxProps } from '@mui/material';

export const ActionRow = ({ children, sx, ...rest }: BoxProps) => (
  <Box
    sx={{
      pb: 1,
      display: 'flex',
      flexDirection: 'row',
      flexGrow: 1,
      alignItems: 'flex-end',
      justifyContent: 'flex-end',
      ...sx,
    }}
    {...rest}
  >
    {children}
  </Box>
);
