import { ReactNode } from 'react';
import { Box, Grid, Typography, useTheme } from '@mui/material';
import { spreadSx, rowSx } from '../../control';
import { layoutGap } from '../../theme';

interface IProps {
  id: string;
  icon: ReactNode;
  title?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}

export default function TeamPanel({
  id,
  icon,
  title,
  actions,
  children,
}: IProps) {
  const theme = useTheme();

  return (
    <Box
      id={id}
      sx={(theme) => ({
        p: layoutGap(theme),
        border: '1px solid transparent',
        borderColor: theme.palette.divider,
        borderRadius: '8px',
        boxShadow: '0 1px 0 0 #1f23280a',
      })}
    >
      <Box sx={[spreadSx, (theme) => ({ pb: layoutGap(theme) })]}>
        <Box sx={[rowSx, { alignItems: 'center' }]}>
          <Box sx={{ display: 'flex', p: 1, color: 'custom.black' }}>
            {icon}
          </Box>
          <Typography noWrap sx={{ fontSize: 'large' }}>
            {title}
          </Typography>
        </Box>
        <Box sx={[rowSx, { alignItems: 'center' }]}>{actions}</Box>
      </Box>
      <Grid container spacing={layoutGap(theme)}>
        {children}
      </Grid>
    </Box>
  );
}
