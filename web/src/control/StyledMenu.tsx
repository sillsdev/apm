import {
  Menu,
  MenuProps,
  MenuItem,
  MenuItemProps,
  styled,
  alpha,
} from '@mui/material';

const MenuWithStyles = styled(Menu)<MenuProps>(() => ({
  '.MuiPaper-root': {
    border: '1px solid #d3d4d5',
  },
}));

export const StyledMenu = (props: MenuProps) => (
  <MenuWithStyles
    elevation={0}
    anchorEl={null}
    anchorOrigin={{
      vertical: 'bottom',
      horizontal: 'right',
    }}
    transformOrigin={{
      vertical: 'top',
      horizontal: 'right',
    }}
    {...props}
  />
);

export const StyledMenuItem = styled(MenuItem)<MenuItemProps>(({ theme }) => ({
  '&:focus': {
    backgroundColor: theme.palette.primary.main,
    '& .MuiListItemIcon-root, & .MuiListItemText-primary': {
      color: theme.palette.common.white,
    },
  },
  '&.Mui-focusVisible': {
    backgroundColor: alpha(theme.palette.primary.main, 0.16),
    '& .MuiListItemIcon-root, & .MuiListItemText-primary': {
      color: 'inherit',
    },
  },
  '&.Mui-selected:hover, &:focus:hover': {
    backgroundColor: alpha(theme.palette.primary.main, 0.8),
  },
  '& .MuiSvgIcon-root': {
    width: '24px',
    height: '24px',
    color: theme.palette.secondary.light,
  },
}));
