import { Box, CircularProgress } from '@mui/material';

export default function Busy() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
      }}
    >
      <CircularProgress size={50} />
    </Box>
  );
}
