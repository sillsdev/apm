import { Box } from '@mui/material';

export const HTMLPage = ({ text }: { text: string }) => {
  return (
    <Box
      sx={{
        // Tighter margins on small screens so content isn't crowded off-screen.
        m: { xs: 1.5, sm: 4 },
        maxWidth: '100%',
        // Break long words/URLs (e.g. policy links) so they never force
        // horizontal scrolling on a narrow viewport.
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
        '& a': { overflowWrap: 'break-word', wordBreak: 'break-word' },
        '& img': { maxWidth: '100%', height: 'auto' },
      }}
      dangerouslySetInnerHTML={{
        __html: text,
      }}
    />
  );
};
