import { createContext, useContext, useState } from 'react';
import { Box, SxProps } from '@mui/material';

const LayoutFabContext = createContext<HTMLElement | null>(null);

export const useLayoutFabAnchor = () => useContext(LayoutFabContext);

interface PassageDetailLayoutProps {
  header: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  footerAbove?: React.ReactNode;
  headerSx?: SxProps;
  contentSx?: SxProps;
  footerSx?: SxProps;
  footerAboveSx?: SxProps;
}

export default function PassageDetailLayout({
  header,
  children,
  footer,
  footerAbove,
  headerSx,
  contentSx,
  footerSx,
  footerAboveSx,
}: PassageDetailLayoutProps) {
  const [fabAnchor, setFabAnchor] = useState<HTMLDivElement | null>(null);

  return (
    <LayoutFabContext.Provider value={fabAnchor}>
      <Box
        sx={{
          width: '100%',
          minWidth: 0,
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <Box sx={{ flexShrink: 0, minWidth: 0, ...headerSx }}>{header}</Box>
        <Box
          sx={{
            position: 'relative',
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              overflowX: 'hidden',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              ...contentSx,
            }}
          >
            {children}
          </Box>
          <Box
            ref={setFabAnchor}
            data-cy="layout-fab-anchor"
            sx={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'flex-end',
              p: 1.5,
              pointerEvents: 'none',
              '& > *': { pointerEvents: 'auto' },
            }}
          />
        </Box>
        {footerAbove && (
          <Box sx={{ flexShrink: 0, minWidth: 0, ...footerAboveSx }}>
            {footerAbove}
          </Box>
        )}
        {footer && (
          <Box sx={{ flexShrink: 0, minWidth: 0, ...footerSx }}>{footer}</Box>
        )}
      </Box>
    </LayoutFabContext.Provider>
  );
}
