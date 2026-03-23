import React from 'react';
import PassageDetailMarkVerses from '../../PassageDetailMarkVerses';

type DesktopProps = {
  width: number;
};

type Props = DesktopProps & {
  DesktopComponent?: React.ComponentType<DesktopProps>;
};

export default function PassageDetailMarkVersesIsMobile({
  DesktopComponent = PassageDetailMarkVerses,
  ...props
}: Props) {
  return <DesktopComponent {...props} />;
}