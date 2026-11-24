import { Box, SxProps, Theme } from '@mui/material';

interface ContentLayoutProps {
  header: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerAbove?: React.ReactNode;
  headerSx?: SxProps<Theme>;
  drawBottomBorder?: boolean;
  contentSx?: SxProps<Theme>;
  footerSx?: SxProps<Theme>;
  footerAboveSx?: SxProps<Theme>;
  contentRef?: React.Ref<HTMLDivElement>;
}

export default function ContentLayout({
  header,
  children,
  footer,
  footerAbove,
  headerSx = [],
  drawBottomBorder = false,
  contentSx = [],
  footerSx = [],
  footerAboveSx = [],
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
        sx={[
          (theme) => ({
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexShrink: 0,
            minWidth: 0,
            px: theme.layout.gap,
            pb: theme.layout.gap,
            backgroundColor: 'custom.headerBackground',
            ...(drawBottomBorder && {
              borderBottom: '1px solid',
              borderColor: 'divider',
            }),
          }),
          ...[headerSx].flat(),
        ]}
      >
        {header}
      </Box>
      <Box
        ref={contentRef}
        sx={[
          {
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            overflowX: 'hidden',
            overflowY: 'auto',
          },
          ...[contentSx].flat(),
        ]}
      >
        {children}
      </Box>
      {footerAbove && (
        <Box sx={[{ flexShrink: 0, minWidth: 0 }, ...[footerAboveSx].flat()]}>
          {footerAbove}
        </Box>
      )}
      {footer && (
        <Box sx={[{ flexShrink: 0, minWidth: 0 }, ...[footerSx].flat()]}>
          {footer}
        </Box>
      )}
    </Box>
  );
}
