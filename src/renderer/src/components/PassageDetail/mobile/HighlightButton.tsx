import { IconButton, SxProps } from '@mui/material';
import type { ReactNode } from 'react';

const highlightSx = {
  backgroundColor: 'primary.main',
  color: 'primary.contrastText',
  '&:hover': {
    backgroundColor: 'primary.dark',
  },
};

interface HighlightButtonProps {
  id?: string;
  ariaLabel: string;
  onClick: () => void;
  disabled: boolean;
  size?: 'small' | 'medium' | 'large';
  highlight?: boolean;
  children: ReactNode;
  sx?: SxProps;
}

export default function HighlightButton({
  id,
  ariaLabel,
  onClick,
  disabled,
  size,
  highlight,
  children,
  sx,
}: HighlightButtonProps) {
  return (
    <IconButton
      id={id}
      aria-label={ariaLabel}
      onClick={onClick}
      disabled={disabled}
      size={size}
      sx={{ ...(highlight ? highlightSx : undefined), ...sx }}
    >
      {children}
    </IconButton>
  );
}
