import { Box, BoxProps } from '@mui/material';

export interface FillColumnProps extends BoxProps {
  /** Use flex:1 instead of height:100% for nested panels. */
  flex?: boolean;
}

/**
 * Column that fills its parent and lets a child (e.g. VertScrollBox / PaddedBox)
 * own scrolling. Keeps plan-tab layout consistent after AppLayout.
 */
export const FillColumn = ({
  children,
  flex = false,
  sx,
  ...rest
}: FillColumnProps) => (
  <Box
    {...rest}
    sx={[
      {
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        width: '100%',
        ...(flex ? { flex: 1 } : { height: '100%' }),
      },
      ...(Array.isArray(sx) ? sx : sx != null ? [sx] : []),
    ]}
  >
    {children}
  </Box>
);
