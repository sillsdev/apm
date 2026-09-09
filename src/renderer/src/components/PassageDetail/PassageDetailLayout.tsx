import { Box, SxProps } from '@mui/material';

interface PassageDetailLayoutProps {
  header: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerAbove?: React.ReactNode;
  headerSx?: SxProps;
  contentSx?: SxProps;
  footerSx?: SxProps;
  footerAboveSx?: SxProps;
}

export default function PassageDetailLayout({
  header,
  children,
  footer,
  footerAbove,
  headerSx,
  contentSx,
  footerSx,
  footerAboveSx,
}: PassageDetailLayoutProps) {
  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flexShrink: 0, ...headerSx }}>{header}</Box>
      <Box
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box
          data-cy="layout-content"
          sx={{
            flex: 1,
            minHeight: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            ...contentSx,
          }}
        >
          <Box sx={{ pb: '70px' }}>{children}</Box>
        </Box>
      </Box>
      {footerAbove && (
        <Box sx={{ flexShrink: 0, ...footerAboveSx }}>{footerAbove}</Box>
      )}
      {footer && <Box sx={{ flexShrink: 0, ...footerSx }}>{footer}</Box>}
    </Box>
  );
}
