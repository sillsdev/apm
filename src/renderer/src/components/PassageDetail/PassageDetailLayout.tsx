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
    <Box
      sx={{
        width: '100%',
        minWidth: 0,
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ flexShrink: 0, minWidth: 0, ...headerSx }}>{header}</Box>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          ...contentSx,
        }}
      >
        {children}
      </Box>
      {footerAbove && (
        <Box sx={{ flexShrink: 0, minWidth: 0, ...footerAboveSx }}>
          {footerAbove}
        </Box>
      )}
      {footer && (
        <Box sx={{ flexShrink: 0, minWidth: 0, ...footerSx }}>{footer}</Box>
      )}
    </Box>
  );
}
