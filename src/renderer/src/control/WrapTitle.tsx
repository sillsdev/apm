import React, { useLayoutEffect, useRef, useState } from 'react';
import { Typography } from '@mui/material';

export type WrapTitleId = string | null | undefined;

interface WrapTitleProps {
  id: string;
  expandedId: WrapTitleId;
  setExpandedId: (id: string | null) => void;
  children: React.ReactNode;
  dataCy?: string;
}

export const WrapTitle: React.FC<WrapTitleProps> = ({
  id,
  expandedId,
  setExpandedId,
  children,
  dataCy,
}) => {
  const titleRef = useRef<HTMLElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const isExpanded = expandedId === id;

  useLayoutEffect(() => {
    if (isExpanded) return;
    const el = titleRef.current;
    if (!el) return;

    const measure = () => {
      setIsTruncated(el.scrollWidth > el.clientWidth + 1);
    };

    measure();
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
      variant="subtitle1"
      onClick={handleClick}
      sx={{
        fontWeight: 'bold',
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
    >
      {children}
    </Typography>
  );
};
