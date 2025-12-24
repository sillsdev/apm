import { AppBar, AppBarProps, styled } from '@mui/material';
import { HeadHeight } from '../App';

export const TabHeight = 52;
export const ActionHeight = 38;

// see: https://mui.com/material-ui/customization/how-to-customize/
export interface TabAppBarProps extends AppBarProps {
  highBar?: boolean;
  mobileBar?: boolean;
}
export const TabAppBar = styled(AppBar, {
  shouldForwardProp: (prop) => prop !== 'highBar' && prop !== 'mobileBar',
})<TabAppBarProps>(({ highBar, mobileBar }) => ({
  top: `calc(${TabHeight}px + ${HeadHeight}px)`,
  height: `${ActionHeight}px`,
  left: 0,
  width: '100%',
  ...(highBar && {
    left: 'auto',
    top: 'auto',
    position: 'unset',
    width: '95%',
  }),
  ...(mobileBar && {
    position: 'unset',
  }),
}));
