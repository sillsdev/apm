import { Box, SxProps } from '@mui/material';

interface PlanScreenLayoutProps {
  header: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerAbove?: React.ReactNode;
  headerSx?: SxProps;
  contentSx?: SxProps;
  footerSx?: SxProps;
  footerAboveSx?: SxProps;
}

export default function PlanScreenLayout({
  header,
  children,
  headerSx,
  contentSx,
}: PlanScreenLayoutProps) {
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
    </Box>
  );
}
