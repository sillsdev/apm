import { Button as MuiButton, ButtonProps, Typography } from '@mui/material';

/**
 * Props for {@link Button}: all MUI `ButtonProps` plus an opt-out of the
 * automatic `Typography` label wrapper.
 */
export interface IButtonProps extends ButtonProps {
  /**
   * When `true`, render `children` as-is instead of wrapping them in a
   * `Typography` element. Use for buttons whose content is not plain text
   * (icons, custom markup) or that must wrap onto multiple lines.
   *
   * @defaultValue false
   */
  disableTypography?: boolean;
}

/**
 * MUI `Button` that wraps its label in a `<Typography noWrap variant="button">`
 * so button text is styled consistently and truncated with an ellipsis rather
 * than wrapping or overflowing its container.
 *
 * All other props are forwarded unchanged to the underlying MUI `Button`.
 *
 * @param props - See {@link IButtonProps}.
 * @returns The rendered button element.
 *
 * @example
 * ```tsx
 * <Button onClick={handleSave}>{t.save}</Button>
 * <Button disableTypography><SaveIcon /></Button>
 * ```
 */
export function Button({ children, disableTypography, ...rest }: IButtonProps) {
  return (
    <MuiButton {...rest}>
      {disableTypography ? (
        children
      ) : (
        <Typography noWrap variant="button">
          {children}
        </Typography>
      )}
    </MuiButton>
  );
}
