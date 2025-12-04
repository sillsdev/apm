import { SxProps } from '@mui/material';

const smallProps = { width: '24px', height: '24px' } as SxProps;
const mediumProps = { width: '40px', height: '40px' } as SxProps;
const largeProps = { width: '48px', height: '48px' } as SxProps;

export const avatarSize = (small?: boolean, medium?: boolean) =>
  medium ? mediumProps : small ? smallProps : largeProps;
