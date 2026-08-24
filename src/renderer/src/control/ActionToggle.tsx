import { Box, BoxProps, styled } from '@mui/material';
import { Button, IButtonProps } from './Button';

export const ActionToggle = styled(Box)<BoxProps>(() => ({
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  '& .MuiButton-label': {
    fontSize: 'x-small',
  },
}));

// see: https://mui.com/material-ui/customization/how-to-customize/
interface StyledButtonProps extends IButtonProps {
  active?: boolean;
}
export const UndButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'active',
})<StyledButtonProps>(({ active }) => ({
  ...(active && {
    textDecoration: 'underline',
  }),
}));

const BarSpan = styled('span')(() => ({
  fontSize: 'x-small',
}));

export const SmallBar = () => <BarSpan>|</BarSpan>;
