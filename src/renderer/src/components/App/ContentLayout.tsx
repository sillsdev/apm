import { Box, SxProps } from '@mui/material';

interface ContentLayoutProps {
  header: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerAbove?: React.ReactNode;
  headerSx?: SxProps;
  drawBottomBorder?: boolean;
  contentSx?: SxProps;
  footerSx?: SxProps;
  footerAboveSx?: SxProps;
  contentRef?: React.Ref<HTMLDivElement>;
}

export default function ContentLayout({
  header,
  children,
  footer,
  footerAbove,
  headerSx,
  drawBottomBorder = false,
  contentSx,
  footerSx,
  footerAboveSx,
  contentRef,
}: ContentLayoutProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minWidth: 0,
        height: '100%',
        minHeight: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          flexShrink: 0,
          minWidth: 0,
          px: 1.5,
          pb: 1.5,
          backgroundColor: 'custom.headerBackground',
          ...(drawBottomBorder && {
            borderBottom: '1px solid',
            borderColor: 'divider',
          }),
          ...headerSx,
        }}
      >
        {header}
      </Box>
      <Box
        ref={contentRef}
        sx={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          overflowX: 'hidden',
          overflowY: 'auto',
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
