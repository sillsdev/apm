import { Box, SxProps } from '@mui/material';

interface ContentLayoutProps {
  header: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerAbove?: React.ReactNode;
  headerSx?: SxProps;
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
  contentSx,
  footerSx,
  footerAboveSx,
  contentRef,
}: ContentLayoutProps) {
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
        ref={contentRef}
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
