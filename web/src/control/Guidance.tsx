import { Typography, TypographyProps } from '@mui/material';

export default function Guidance({ children, sx, ...props }: TypographyProps) {
  return (
    <Typography
      variant="body2"
      sx={{
        display: 'inline-block',
        lineHeight: 2,
        whiteSpace: 'wrap',
        py: 3,
        m: 'auto',
        width: '100%',
        textAlign: 'center',
        ...sx,
      }}
      {...props}
    >
      {children}
    </Typography>
  );
}
