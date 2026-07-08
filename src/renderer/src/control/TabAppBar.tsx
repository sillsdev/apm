import { Box, SxProps } from '@mui/material';
import { HeadHeight } from '../layout';

export const TabHeight = 52;
export const ActionHeight = 38;

export interface TabAppBarProps {
  bar: React.ReactNode;
  children: React.ReactNode;
  contentSx?: SxProps;
}

export function TabAppBar({ bar, children, contentSx }: TabAppBarProps) {
  return (
    <Box
      sx={{
        width: '100%',
        minWidth: 0,
        // 100vh on mobile often exceeds the *visible* viewport (URL bar / Samsung browser chrome),
        // so the flex footer sits below the fold. 100dvh tracks the dynamic viewport.
        height: `calc(100vh - ${HeadHeight}px)`,
        '@supports (height: 100dvh)': {
          height: `calc(100dvh - ${HeadHeight}px)`,
        },
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          backgroundColor: 'custom.headerBackground',
          borderBottom: '1px solid',
          borderColor: 'divider',
          py: 1,
          px: 1.5,
        }}
      >
        {bar}
      </Box>
      <Box
        sx={{
          backgroundColor: 'background.default',
          px: 1.5,
          pt: 1.5,
          pb: 1.5,
          flex: 1,
          minWidth: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
          ...contentSx,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
