import { Box, SxProps } from '@mui/material';
import { HeadHeight } from '../../layout';

interface Props {
  header: React.ReactNode;
  footer: React.ReactNode;
  footerAbove?: React.ReactNode;
  children: React.ReactNode;
  contentSx?: SxProps;
}

export default function PassageDetailMobileLayout({
  header,
  footer,
  footerAbove,
  children,
  contentSx,
}: Props) {
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
        }}
      >
        {header}
      </Box>
      <Box
        sx={{
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
      {footerAbove && (
        <Box
          sx={{
            backgroundColor: 'background.default',
            px: 1,
            py: 0.5,
          }}
        >
          {footerAbove}
        </Box>
      )}
      <Box
        sx={{
          backgroundColor: 'background.default',
          borderTop: '1px solid',
          borderColor: 'divider',
          px: 1,
          pt: '4px',
          pb: 'calc(2px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {footer}
      </Box>
    </Box>
  );
}
