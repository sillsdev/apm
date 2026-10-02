import type { ComponentPropsWithoutRef } from 'react';
import apmLogo from '../assets/apm-logo.svg';

const baseStyle = { alignSelf: 'center' } as const;

interface IProps extends Omit<
  ComponentPropsWithoutRef<'img'>,
  'src' | 'width' | 'height'
> {
  size?: number;
}

export const ApmLogo = ({
  size = 256,
  alt = 'Audio Project Manager logo',
  style,
  ...rest
}: IProps) => {
  return (
    <img
      src={apmLogo}
      width={size}
      height={size}
      alt={alt}
      draggable={false}
      style={style ? { ...baseStyle, ...style } : baseStyle}
      {...rest}
    />
  );
};
