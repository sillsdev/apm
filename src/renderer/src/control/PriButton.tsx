import { Button, IButtonProps } from './Button';

export const PriButton = ({ children, ...rest }: IButtonProps) => (
  <Button variant="contained" color="primary" sx={{ m: 1 }} {...rest}>
    {children}
  </Button>
);
