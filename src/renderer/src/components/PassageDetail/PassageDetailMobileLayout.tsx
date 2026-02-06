import { Box, SxProps } from '@mui/material';
import { HeadHeight } from '../../App';

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
        height: `calc(100vh - ${HeadHeight}px)`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          backgroundColor: 'background.default',
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
          py: 0.5,
        }}
      >
        {footer}
      </Box>
    </Box>
  );
}
