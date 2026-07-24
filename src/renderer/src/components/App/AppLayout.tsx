import { Box } from '@mui/material';
import AppHead, { AppHeadProps } from './AppHead';

interface AppLayoutProps {
  appHeadProps?: Omit<AppHeadProps, 'position'>;
  children: React.ReactNode;
}

export default function AppLayout({ appHeadProps, children }: AppLayoutProps) {
  return (
    <Box
      sx={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <AppHead {...appHeadProps} position="static" />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{children}</Box>
    </Box>
  );
}
