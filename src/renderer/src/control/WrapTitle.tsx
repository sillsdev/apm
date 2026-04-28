import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Typography, TypographyProps } from '@mui/material';

export type WrapTitleId = string | null | undefined;

interface WrapTitleProps {
  id: string;
  expandedId: WrapTitleId;
  setExpandedId: (id: string | null) => void;
  typographyProps?: TypographyProps;
  children: React.ReactNode;
  dataCy?: string;
}

export const WrapTitle: React.FC<WrapTitleProps> = ({
  id,
  expandedId,
  setExpandedId,
  typographyProps,
  children,
  dataCy,
}) => {
  const titleRef = useRef<HTMLElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const isExpanded = useMemo(() => expandedId === id, [expandedId, id]);

  useLayoutEffect(() => {
    if (isExpanded) return;
    const el = titleRef.current;
    if (!el) return;

    const measure = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth + 1);
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children, isExpanded]);

  const handleClick = (e: React.MouseEvent) => {
    if (isExpanded) {
      e.stopPropagation();
      setExpandedId(null);
      return;
    }
    if (isTruncated) {
      e.stopPropagation();
      setExpandedId(id);
    }
  };

  return (
    <Typography
      ref={titleRef}
      data-cy={dataCy}
      {...typographyProps}
      sx={{
        fontWeight: 'bold',
        ...typographyProps?.sx,
        display: 'block',
        width: '100%',
        minWidth: 0,
        maxWidth: '100%',
        ...(isExpanded
          ? {
              whiteSpace: 'normal',
              wordBreak: 'break-word',
              overflow: 'visible',
              textOverflow: 'clip',
              cursor: 'pointer',
            }
          : {
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: isTruncated ? 'pointer' : 'inherit',
            }),
      }}
      onClick={handleClick}
    >
      {children}
    </Typography>
  );
};
