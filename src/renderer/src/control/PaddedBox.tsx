import { styled } from '@mui/material';

export const PaddedBox = styled('div')(({ theme }) => ({
  paddingTop: theme.spacing(2),
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
}));
