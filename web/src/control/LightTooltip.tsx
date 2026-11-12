import { styled, Tooltip, TooltipProps, tooltipClasses } from '@mui/material';

// styled(Tooltip) forwards the generated class onto the Tooltip's child element,
// not the tooltip bubble — which paints the wrapped icon white. Apply the class
// to the popper slot instead and target the actual tooltip element.
export const LightTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: theme.palette.common.white,
    color: 'rgba(0, 0, 0, 0.87)',
    fontSize: 11,
  },
}));
