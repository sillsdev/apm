import { useState } from 'react';
import { Box, alpha } from '@mui/material';
import { useGlobal } from '../../context/useGlobal';
import Busy from '../Busy';
import AppHead, { AppHeadProps } from './AppHead';

interface AppLayoutProps {
  appHeadProps?: Omit<AppHeadProps, 'position' | 'onDownloadAlert'>;
  children: React.ReactNode;
}

export default function AppLayout({ appHeadProps, children }: AppLayoutProps) {
  const [importexportBusy] = useGlobal('importexportBusy');
  const [downloadAlert, setDownloadAlert] = useState(false);
  const showBusy = importexportBusy && !downloadAlert;

  return (
    <Box
      sx={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ flexShrink: 0 }}>
        <AppHead
          {...appHeadProps}
          position="relative"
          onDownloadAlert={setDownloadAlert}
        />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <Box sx={{ height: '100%', overflow: 'auto' }}>{children}</Box>
        {/* Must be rendered as an overlay so that dialogs would appear on top of it  */}
        {showBusy && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: (theme) => theme.zIndex.drawer,
              backgroundColor: (theme) =>
                alpha(theme.palette.background.default, 0.75),
            }}
          >
            <Busy />
          </Box>
        )}
      </Box>
    </Box>
  );
}
