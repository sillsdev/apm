import { ReactNode } from 'react';
import { Typography } from '@mui/material';

interface IProps {
  children?: ReactNode;
}

export function PassageCardTitle({ children }: IProps) {
  return (
    <Typography
      variant="h6"
      sx={{
        lineHeight: (theme) => theme.spacing(3.5),
        minWidth: 0,
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: 2,
        overflow: 'hidden',
        overflowWrap: 'anywhere',
      }}
    >
      {children}
    </Typography>
  );
}
