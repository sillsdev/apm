import { Box, BoxProps } from '@mui/material';

export const VertScrollBox = ({ children, ...rest }: BoxProps) => (
  <Box
    sx={{
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      overflowX: 'hidden',
    }}
    {...rest}
  >
    {children}
  </Box>
);
