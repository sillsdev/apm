import { Box } from '@mui/material';

interface AppLayoutProps {
  header: React.ReactNode;
  content: React.ReactNode;
}

export default function AppLayout({ header, content }: AppLayoutProps) {
  return (
    <Box
      sx={{
        width: '100%',
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ position: 'relative', flexShrink: 0 }}>{header}</Box>
      <Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {content}
      </Box>
    </Box>
  );
}
