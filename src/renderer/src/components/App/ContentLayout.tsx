import { Box, SxProps, Theme } from '@mui/material';
import { tintedSurfaceSx } from '../../theme';

// Normalize sx (object | callback | array | undefined) to an array so it can be spread after base styles
const asSxArray = (sx?: SxProps<Theme>) => (Array.isArray(sx) ? sx : [sx]);

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
        sx={[
          (theme) => ({
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexShrink: 0,
            minWidth: 0,
            px: theme.layout.gap,
            pb: theme.layout.gap,
            ...tintedSurfaceSx,
            ...(drawBottomBorder && {
              borderBottom: '1px solid',
              borderColor: 'divider',
            }),
          }),
          ...asSxArray(headerSx),
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
          ...asSxArray(contentSx),
        ]}
      >
        {children}
      </Box>
      {footerAbove && (
        <Box sx={[{ flexShrink: 0, minWidth: 0 }, ...asSxArray(footerAboveSx)]}>
          {footerAbove}
        </Box>
      )}
      {footer && (
        <Box sx={[{ flexShrink: 0, minWidth: 0 }, ...asSxArray(footerSx)]}>
          {footer}
        </Box>
      )}
    </Box>
  );
}
