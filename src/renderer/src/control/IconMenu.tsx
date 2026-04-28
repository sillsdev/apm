import { IconButton, Menu } from '@mui/material';
import { LightTooltip } from '../components/PassageDetail/Internalization';
import { PropsWithChildren, useState } from 'react';

function IconMenuTrigger(props: {
  open: boolean;
  icon: React.ReactNode;
  handleClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  const { open, icon, handleClick } = props;

  return (
    <IconButton
      onClick={handleClick}
      size="small"
      sx={{ ml: 2 }}
      aria-controls={open ? 'icon-menu' : undefined}
      aria-haspopup="true"
      aria-expanded={open ? 'true' : undefined}
    >
      {icon}
    </IconButton>
  );
}

interface IProps extends PropsWithChildren {
  tip?: string;
  icon: React.ReactNode;
}

export default function IconMenu(props: IProps) {
  const { tip, icon, children } = props;
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      {tip ? (
        <LightTooltip id="iconMenuTip" title={tip}>
          <IconMenuTrigger open={open} icon={icon} handleClick={handleClick} />
        </LightTooltip>
      ) : (
        <IconMenuTrigger open={open} icon={icon} handleClick={handleClick} />
      )}
      <Menu
        anchorEl={anchorEl}
        id="icon-menu"
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        slotProps={{
          paper: {
            elevation: 0,
            sx: {
              overflow: 'visible',
              filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
              mt: 1.5,
              '& .MuiAvatar-root': {
                width: 32,
                height: 32,
                ml: -0.5,
                mr: 1,
              },
              '&::before': {
                content: '""',
                display: 'block',
                position: 'absolute',
                top: 0,
                right: 14,
                width: 10,
                height: 10,
                bgcolor: 'background.paper',
                transform: 'translateY(-50%) rotate(45deg)',
                zIndex: 0,
              },
            },
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        {children}
      </Menu>
    </>
  );
}
